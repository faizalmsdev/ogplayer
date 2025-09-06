require('dotenv').config();
const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = 3001;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Enable CORS with enhanced headers for media streaming
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Cache for search results, stream URLs, and Spotify data
const searchCache = new Map();
const streamCache = new Map();
const spotifyCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Spotify API configuration (you can get these from Spotify Developer Dashboard)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
let spotifyAccessToken = null;
let spotifyTokenExpiry = null;

// User agents to rotate for better success rate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

// Cookie management for YouTube
const COOKIES_FILE = path.join(__dirname, 'youtube_cookies.txt');

// Function to check if cookies file exists
function hasCookiesFile() {
  return fs.existsSync(COOKIES_FILE);
}

// Helper function to run yt-dlp commands with improved anti-bot measures
function runYtDlp(args, retries = 3) {
  return new Promise((resolve, reject) => {
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    // Enhanced arguments for better YouTube compatibility, especially for servers
    const enhancedArgs = [
      '--user-agent', userAgent,
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept-Encoding:gzip, deflate, br',
      '--add-header', 'Cache-Control:no-cache',
      '--add-header', 'Pragma:no-cache',
      '--add-header', 'Sec-Fetch-Dest:document',
      '--add-header', 'Sec-Fetch-Mode:navigate',
      '--add-header', 'Sec-Fetch-Site:none',
      '--add-header', 'Upgrade-Insecure-Requests:1',
      '--sleep-interval', '1',
      '--max-sleep-interval', '5',
      '--socket-timeout', '30',
      '--no-warnings',
      '--no-check-certificate',
      '--prefer-insecure',
      '--extractor-retries', '3',
      '--fragment-retries', '3',
      '--retry-sleep', 'linear=2',
    ];

    // Add cookies if available
    if (hasCookiesFile()) {
      enhancedArgs.push('--cookies', COOKIES_FILE);
      console.log('🍪 Using cookies file for authentication');
    }

    // Add proxy support if available
    if (process.env.HTTP_PROXY) {
      enhancedArgs.push('--proxy', process.env.HTTP_PROXY);
      console.log('🔗 Using HTTP proxy');
    }

    const finalArgs = [...enhancedArgs, ...args];

    const ytdlp = spawn('yt-dlp', finalArgs);
    let output = '';
    let error = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      error += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        // Check if we should retry
        if (retries > 0 && (error.includes('Precondition check failed') || 
                           error.includes('HTTP Error 400') || 
                           error.includes('HTTP Error 403') ||
                           error.includes('HTTP Error 429') ||
                           error.includes('not available on this app') ||
                           error.includes('Sign in to confirm') ||
                           error.includes('blocked'))) {
          console.log(`Retrying yt-dlp command... (${retries} retries left)`);
          setTimeout(() => {
            runYtDlp(args, retries - 1).then(resolve).catch(reject);
          }, Math.random() * 3000 + 2000 * (4 - retries)); // Random + exponential backoff
        } else {
          reject(new Error(`yt-dlp failed: ${error}`));
        }
      }
    });
  });
}

// Spotify API functions
async function getSpotifyAccessToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return null; // Skip Spotify if credentials not provided
  }

  if (spotifyAccessToken && spotifyTokenExpiry && Date.now() < spotifyTokenExpiry) {
    return spotifyAccessToken;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    
    if (data.access_token) {
      spotifyAccessToken = data.access_token;
      spotifyTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early
      return spotifyAccessToken;
    }
  } catch (error) {
    console.warn('Failed to get Spotify access token:', error.message);
  }
  
  return null;
}

async function searchSpotifyTrack(query) {
  const cacheKey = `spotify_${query}`;
  
  // Check cache first
  if (spotifyCache.has(cacheKey)) {
    const cached = spotifyCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  const token = await getSpotifyAccessToken();
  if (!token) return null;

  try {
    const fetch = (await import('node-fetch')).default;
    const searchQuery = encodeURIComponent(query.replace(/official|music|video|lyrics/gi, '').trim());
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    
    if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
      const track = data.tracks.items[0];
      const result = {
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        cover_art: track.album.images.length > 0 ? track.album.images[0].url : null,
        cover_art_medium: track.album.images.length > 1 ? track.album.images[1].url : null,
        cover_art_small: track.album.images.length > 2 ? track.album.images[2].url : null,
        spotify_url: track.external_urls.spotify,
        preview_url: track.preview_url,
        duration_ms: track.duration_ms
      };
      
      // Cache the result
      spotifyCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    }
  } catch (error) {
    console.warn('Spotify search error:', error.message);
  }
  
  return null;
}

// Helper function to clean song title for better Spotify matching
function cleanSongTitle(title) {
  return title
    .replace(/\(.*?\)/g, '') // Remove parentheses content
    .replace(/\[.*?\]/g, '') // Remove bracket content
    .replace(/official|music|video|mv|hd|4k|lyrics|audio|visualizer/gi, '') // Remove common video terms
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// API: Search for songs on YouTube with enhanced thumbnails
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const limit = parseInt(req.query.limit) || 10;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  // Check cache first
  const cacheKey = `${query}_${limit}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }
  }

  try {
    console.log(`🔍 Searching for: ${query}`);
    
    const args = [
      '--dump-json',
      '--flat-playlist',
      '--extractor-args', 'youtube:player_client=android',
      '--extractor-args', 'youtube:player_skip=webpage',
      `ytsearch${limit}:${query}`
    ];

    const output = await runYtDlp(args);
    const results = [];
    
    // Parse each line as JSON
    const lines = output.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.id && data.title) {
          // Generate high-quality thumbnail URLs
          const videoId = data.id;
          const thumbnails = {
            default: `https://img.youtube.com/vi/${videoId}/default.jpg`, // 120x90
            medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, // 320x180
            high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, // 480x360
            standard: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`, // 640x480
            maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` // 1280x720
          };

          results.push({
            id: data.id,
            title: data.title,
            duration: data.duration || 0,
            duration_string: data.duration_string || 'Unknown',
            uploader: data.uploader || 'Unknown',
            view_count: data.view_count || 0,
            // Use high-quality thumbnail as primary
            thumbnail: thumbnails.high,
            // Provide all thumbnail qualities
            thumbnails: thumbnails,
            // Original YouTube thumbnail as fallback
            original_thumbnail: data.thumbnail,
            url: `https://youtube.com/watch?v=${data.id}`,
            stream_url: `/api/stream/${data.id}`,
            // Additional metadata
            description: data.description || '',
            upload_date: data.upload_date || '',
            uploader_id: data.uploader_id || ''
          });
        }
      } catch (e) {
        console.warn('Failed to parse line:', line);
      }
    }

    const response = {
      query: query,
      results: results,
      total: results.length
    };

    // Cache the results
    searchCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    console.log(`✅ Found ${results.length} results for: ${query}`);
    res.json(response);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// API: Get stream URL for a video with enhanced compatibility and proxy streaming
app.get('/api/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  // Check cache first
  if (streamCache.has(videoId)) {
    const cached = streamCache.get(videoId);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return proxyStream(cached.url, req, res);
    }
  }

  try {
    console.log(`🎵 Getting stream URL for: ${videoId}`);
    
    // Try multiple format strategies for better compatibility
    const formatStrategies = [
      'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[ext=mp4]/bestaudio',
      'bestaudio[acodec=aac]/bestaudio[acodec=mp4a]/bestaudio',
      'bestaudio/best[height<=480]',
      'best[height<=360]/worst'
    ];

    let streamUrl = null;
    let lastError = null;

    for (const format of formatStrategies) {
      try {
        const args = [
          '--get-url',
          '--format', format,
          '--extractor-args', 'youtube:player_client=android',
          '--extractor-args', 'youtube:player_skip=webpage',
          `https://youtube.com/watch?v=${videoId}`
        ];

        streamUrl = await runYtDlp(args);
        if (streamUrl && streamUrl.startsWith('http')) {
          console.log(`✅ Stream URL obtained using format: ${format}`);
          break;
        }
      } catch (error) {
        lastError = error;
        console.log(`❌ Failed with format ${format}, trying next...`);
        continue;
      }
    }
    
    if (streamUrl && streamUrl.startsWith('http')) {
      // Cache the stream URL
      streamCache.set(videoId, {
        url: streamUrl,
        timestamp: Date.now()
      });

      console.log(`✅ Stream URL obtained for: ${videoId}`);
      
      // Proxy the stream instead of redirecting to avoid CORS issues
      return proxyStream(streamUrl, req, res);
      
    } else {
      console.error('All format strategies failed for:', videoId);
      res.status(404).json({ 
        error: 'Stream URL not found', 
        details: 'All extraction methods failed. YouTube may have restricted this video.',
        videoId: videoId
      });
    }

  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ 
      error: 'Failed to get stream URL', 
      details: error.message,
      suggestion: 'Try updating yt-dlp: pip install -U yt-dlp'
    });
  }
});

// Function to proxy stream with proper headers for CORS
function proxyStream(streamUrl, req, res) {
  const https = require('https');
  const url = require('url');
  
  const parsedUrl = url.parse(streamUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  const httpModule = isHttps ? https : require('http');
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.path,
    method: req.method,
    headers: {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
      // Forward range headers for seeking support
      ...(req.headers.range && { 'Range': req.headers.range })
    }
  };

  const proxyReq = httpModule.request(options, (proxyRes) => {
    // Set CORS and media streaming headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Forward content headers
    if (proxyRes.headers['content-type']) {
      res.setHeader('Content-Type', proxyRes.headers['content-type']);
    }
    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    if (proxyRes.headers['content-range']) {
      res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }
    if (proxyRes.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
    }
    
    // Set status code
    res.statusCode = proxyRes.statusCode;
    
    // Pipe the response
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Stream proxy failed', 
        details: error.message 
      });
    }
  });

  // Handle client disconnect
  req.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.end();
}

// Alternative endpoint to get direct stream URL (for testing/debugging)
app.get('/api/stream-url/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  // Check cache first
  if (streamCache.has(videoId)) {
    const cached = streamCache.get(videoId);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json({ 
        success: true, 
        streamUrl: cached.url, 
        videoId: videoId,
        cached: true
      });
    }
  }

  try {
    console.log(`🎵 Getting direct stream URL for: ${videoId}`);
    
    const args = [
      '--get-url',
      '--format', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
      '--extractor-args', 'youtube:player_client=android',
      '--extractor-args', 'youtube:player_skip=webpage',
      `https://youtube.com/watch?v=${videoId}`
    ];

    const streamUrl = await runYtDlp(args);
    
    if (streamUrl && streamUrl.startsWith('http')) {
      // Cache the stream URL
      streamCache.set(videoId, {
        url: streamUrl,
        timestamp: Date.now()
      });

      console.log(`✅ Direct stream URL obtained for: ${videoId}`);
      res.json({ 
        success: true, 
        streamUrl: streamUrl, 
        videoId: videoId,
        cached: false
      });
    } else {
      res.status(404).json({ 
        success: false,
        error: 'Stream URL not found', 
        videoId: videoId
      });
    }

  } catch (error) {
    console.error('Direct stream error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get direct stream URL', 
      details: error.message,
      videoId: videoId
    });
  }
});

// API: Get video info with enhanced thumbnails
app.get('/api/info/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  try {
    console.log(`ℹ️ Getting info for: ${videoId}`);
    
    const args = [
      '--dump-json',
      '--extractor-args', 'youtube:player_client=android',
      '--extractor-args', 'youtube:player_skip=webpage',
      `https://youtube.com/watch?v=${videoId}`
    ];

    const output = await runYtDlp(args);
    const data = JSON.parse(output);
    
    // Generate high-quality thumbnail URLs
    const thumbnails = {
      default: `https://img.youtube.com/vi/${videoId}/default.jpg`, // 120x90
      medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, // 320x180
      high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, // 480x360
      standard: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`, // 640x480
      maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` // 1280x720
    };
    
    const info = {
      id: data.id,
      title: data.title,
      duration: data.duration || 0,
      duration_string: data.duration_string || 'Unknown',
      uploader: data.uploader || 'Unknown',
      description: data.description || '',
      view_count: data.view_count || 0,
      like_count: data.like_count || 0,
      // Use high-quality thumbnail as primary
      thumbnail: thumbnails.high,
      // Provide all thumbnail qualities
      thumbnails: thumbnails,
      // Original thumbnail as fallback
      original_thumbnail: data.thumbnail,
      url: `https://youtube.com/watch?v=${data.id}`,
      stream_url: `/api/stream/${data.id}`,
      upload_date: data.upload_date || '',
      uploader_id: data.uploader_id || ''
    };

    res.json(info);

  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: 'Failed to get video info', details: error.message });
  }
});

// Socket.IO for real-time features
const rooms = {};

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('join_room', ({ room }) => {
    socket.join(room);
    
    if (!rooms[room]) {
      rooms[room] = {
        users: new Set(),
        currentSong: null,
        queue: [],
        isPlaying: false
      };
    }
    
    rooms[room].users.add(socket.id);
    socket.room = room;
    
    console.log(`User ${socket.id} joined room ${room}`);
    
    // Send current state to new user
    socket.emit('room_state', {
      currentSong: rooms[room].currentSong,
      queue: rooms[room].queue,
      isPlaying: rooms[room].isPlaying
    });
  });

  socket.on('play_song', ({ room, song }) => {
    if (rooms[room]) {
      rooms[room].currentSong = song;
      rooms[room].isPlaying = true;
      
      console.log(`🎵 Playing in room ${room}: ${song.title}`);
      
      io.to(room).emit('song_changed', {
        song: song,
        isPlaying: true
      });
    }
  });

  socket.on('add_to_queue', ({ room, song }) => {
    if (rooms[room]) {
      rooms[room].queue.push(song);
      
      console.log(`➕ Added to queue in room ${room}: ${song.title}`);
      
      io.to(room).emit('queue_updated', {
        queue: rooms[room].queue
      });
    }
  });

  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].users.delete(socket.id);
      if (rooms[room].users.size === 0) {
        delete rooms[room];
        console.log(`Room ${room} deleted (no users)`);
      }
    }
    console.log(`User ${socket.id} disconnected`);
  });
});

// Health check
app.get("/ping", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Simple YouTube Music Server"
  });
});


// Function to update yt-dlp
function updateYtDlp() {
  return new Promise((resolve, reject) => {
    const updateProcess = spawn('yt-dlp', ['-U']);
    let output = '';
    let error = '';

    updateProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    updateProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    updateProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(error));
      }
    });
  });
}

// API endpoint to update yt-dlp
app.post('/api/update-ytdlp', async (req, res) => {
  try {
    console.log('🔄 Updating yt-dlp...');
    const result = await updateYtDlp();
    console.log('✅ yt-dlp updated successfully');
    res.json({ 
      success: true, 
      message: 'yt-dlp updated successfully',
      output: result
    });
  } catch (error) {
    console.error('❌ Failed to update yt-dlp:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update yt-dlp', 
      details: error.message 
    });
  }
});

// API endpoint to upload cookies
app.post('/api/upload-cookies', express.text(), (req, res) => {
  try {
    const cookiesContent = req.body;
    
    if (!cookiesContent || cookiesContent.trim().length === 0) {
      return res.status(400).json({ error: 'No cookies content provided' });
    }

    fs.writeFileSync(COOKIES_FILE, cookiesContent);
    console.log('🍪 Cookies file updated');
    
    res.json({ 
      success: true, 
      message: 'Cookies uploaded successfully',
      file: COOKIES_FILE
    });
  } catch (error) {
    console.error('❌ Failed to save cookies:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save cookies', 
      details: error.message 
    });
  }
});

// API endpoint to check cookies status
app.get('/api/cookies-status', (req, res) => {
  const hasFile = hasCookiesFile();
  let stats = null;
  
  if (hasFile) {
    try {
      stats = fs.statSync(COOKIES_FILE);
    } catch (e) {
      // File exists but can't read stats
    }
  }
  
  res.json({
    hasCookies: hasFile,
    cookiesFile: COOKIES_FILE,
    lastModified: stats ? stats.mtime : null,
    size: stats ? stats.size : null
  });
});

// API endpoint to delete cookies
app.delete('/api/cookies', (req, res) => {
  try {
    if (hasCookiesFile()) {
      fs.unlinkSync(COOKIES_FILE);
      console.log('🗑️ Cookies file deleted');
    }
    
    res.json({ 
      success: true, 
      message: 'Cookies deleted successfully'
    });
  } catch (error) {
    console.error('❌ Failed to delete cookies:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete cookies', 
      details: error.message 
    });
  }
});

// Check if yt-dlp is installed and its version
exec('yt-dlp --version', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ yt-dlp not found! Please install it:');
    console.error('   pip install yt-dlp');
    console.error('   or download from: https://github.com/yt-dlp/yt-dlp');
  } else {
    console.log(`✅ yt-dlp version: ${stdout.trim()}`);
    
    // Auto-update if version is old (optional)
    const version = stdout.trim();
    if (version.includes('2023.') || version.includes('2024.01') || version.includes('2024.02')) {
      console.log('⚠️ Your yt-dlp version might be outdated. Consider updating with: yt-dlp -U');
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎵 Simple YouTube Music Server running at http://localhost:${PORT}`);
  console.log('');
  console.log('Features:');
  console.log('- 🔍 Search YouTube music: GET /api/search?q=query');
  console.log('- 🎵 Stream music: GET /api/stream/:videoId');
  console.log('- ℹ️ Get video info: GET /api/info/:videoId');
  console.log('- 🏠 Web interface: GET /');
  console.log('');
  console.log('Requirements:');
  console.log('- yt-dlp must be installed (pip install yt-dlp)');
  console.log('');
});
