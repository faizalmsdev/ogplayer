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

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

// Helper function to run yt-dlp commands
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', args);
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
        reject(new Error(`yt-dlp failed: ${error}`));
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
      '--no-warnings',
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

// API: Get stream URL for a video
app.get('/api/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  // Check cache first
  if (streamCache.has(videoId)) {
    const cached = streamCache.get(videoId);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.redirect(cached.url);
    }
  }

  try {
    console.log(`🎵 Getting stream URL for: ${videoId}`);
    
    const args = [
      '--get-url',
      '--format', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
      '--no-warnings',
      `https://youtube.com/watch?v=${videoId}`
    ];

    const streamUrl = await runYtDlp(args);
    
    if (streamUrl) {
      // Cache the stream URL
      streamCache.set(videoId, {
        url: streamUrl,
        timestamp: Date.now()
      });

      console.log(`✅ Stream URL obtained for: ${videoId}`);
      res.redirect(streamUrl);
    } else {
      res.status(404).json({ error: 'Stream URL not found' });
    }

  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to get stream URL', details: error.message });
  }
});

// API: Get video info with enhanced thumbnails
app.get('/api/info/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  try {
    console.log(`ℹ️ Getting info for: ${videoId}`);
    
    const args = [
      '--dump-json',
      '--no-warnings',
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


// Check if yt-dlp is installed
exec('yt-dlp --version', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ yt-dlp not found! Please install it:');
    console.error('   pip install yt-dlp');
    console.error('   or download from: https://github.com/yt-dlp/yt-dlp');
  } else {
    console.log(`✅ yt-dlp version: ${stdout.trim()}`);
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
