const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Updated paths for consolidated structure
const consolidatedPath = path.join(__dirname, 'public', 'consolidated_music');
const songsPath = path.join(consolidatedPath, 'songs');
const metadataPath = path.join(consolidatedPath, 'metadata');

// GitHub base URL for songs
const GITHUB_SONGS_BASE_URL = 'https://raw.githubusercontent.com/faizalmsdev/audio-player/master/public/consolidated_music/songs';

app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Helper function to load JSON files
function loadJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err);
    return null;
  }
}

// API: Get all playlists with song counts
app.get('/playlists', (req, res) => {
  const playlistsDb = loadJsonFile(path.join(metadataPath, 'playlists_database.json'));
  
  if (!playlistsDb) {
    return res.status(500).json({ error: 'Unable to load playlists database' });
  }
  
  const playlists = {};
  Object.entries(playlistsDb.playlists).forEach(([playlistName, playlistInfo]) => {
    playlists[playlistName] = {
      name: playlistName,
      total_tracks: playlistInfo.total_tracks,
      successful_downloads: playlistInfo.successful_downloads,
      unique_song_count: playlistInfo.unique_song_count,
      source_url: playlistInfo.source_url,
      timestamp: playlistInfo.timestamp,
      songs: playlistInfo.songs || []
    };
  });
  
  console.log(`Loaded ${Object.keys(playlists).length} playlists`);
  res.json(playlists);
});

// API: Get all songs (for backwards compatibility)
app.get('/songs', (req, res) => {
  // Redirect to new playlists endpoint
  res.redirect('/playlists');
});

// API: Get all unique songs in the database
app.get('/all-songs', (req, res) => {
  const songsDb = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
  
  if (!songsDb) {
    return res.status(500).json({ error: 'Unable to load songs database' });
  }
  
  const songs = Object.entries(songsDb.songs).map(([songId, songInfo]) => ({
    song_id: songId,
    filename: songInfo.filename,
    track_name: songInfo.metadata?.track_name || 'Unknown',
    artists_string: songInfo.metadata?.artists_string || 'Unknown Artist',
    album_name: songInfo.metadata?.album_name,
    duration_formatted: songInfo.metadata?.duration_formatted,
    playcount: songInfo.metadata?.playcount,
    cover_art_url: songInfo.metadata?.cover_art_url,
    cover_art_filename: songInfo.metadata?.cover_art_filename,
    playlists: songInfo.playlists,
    // Add GitHub URL for direct access
    github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
  }));
  
  res.json({
    total_songs: songs.length,
    songs: songs
  });
});

// API: Get metadata for a specific playlist
app.get('/metadata/:playlist', (req, res) => {
  const playlistName = req.params.playlist;
  const playlistsDb = loadJsonFile(path.join(metadataPath, 'playlists_database.json'));
  const songsDb = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
  
  if (!playlistsDb || !songsDb) {
    return res.status(500).json({ error: 'Unable to load database files' });
  }
  
  const playlist = playlistsDb.playlists[playlistName];
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  // Build download_results format for backwards compatibility
  const download_results = [];
  
  if (playlist.songs) {
    playlist.songs.forEach(songId => {
      const songInfo = songsDb.songs[songId];
      if (songInfo) {
        download_results.push({
          track_name: songInfo.metadata?.track_name,
          artists: songInfo.metadata?.artists_string,
          filename: songInfo.filename,
          status: 'success',
          metadata: songInfo.metadata,
          // Add GitHub URL
          github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
        });
      }
    });
  }
  
  console.log(`Metadata loaded for ${playlistName}: ${download_results.length} tracks`);
  
  res.json({
    download_info: {
      total_tracks: playlist.total_tracks,
      successful_downloads: playlist.successful_downloads,
      source_url: playlist.source_url,
      timestamp: playlist.timestamp
    },
    download_results: download_results
  });
});

// API: Get songs for a specific playlist
app.get('/playlist/:playlist/songs', (req, res) => {
  const playlistName = req.params.playlist;
  const playlistsDb = loadJsonFile(path.join(metadataPath, 'playlists_database.json'));
  const songsDb = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
  
  if (!playlistsDb || !songsDb) {
    return res.status(500).json({ error: 'Unable to load database files' });
  }
  
  const playlist = playlistsDb.playlists[playlistName];
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  const songsWithMetadata = [];
  
  if (playlist.songs) {
    playlist.songs.forEach(songId => {
      const songInfo = songsDb.songs[songId];
      if (songInfo) {
        songsWithMetadata.push({
          song_id: songId,
          filename: songInfo.filename,
          track_name: songInfo.metadata?.track_name || songInfo.filename.replace(/\.[^/.]+$/, ""),
          artists_string: songInfo.metadata?.artists_string || 'Unknown Artist',
          cover_art_url: songInfo.metadata?.cover_art_url,
          cover_art_filename: songInfo.metadata?.cover_art_filename,
          album_name: songInfo.metadata?.album_name,
          duration_formatted: songInfo.metadata?.duration_formatted,
          playcount: songInfo.metadata?.playcount,
          playlists: songInfo.playlists,
          // Add GitHub URL for direct access
          github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
        });
      }
    });
  }
  
  res.json({
    playlist: playlistName,
    songs: songsWithMetadata,
    total_songs: songsWithMetadata.length,
    unique_songs: playlist.unique_song_count
  });
});

// API: Get song info by song ID
app.get('/song/:songId', (req, res) => {
  const songId = req.params.songId;
  const songsDb = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
  
  if (!songsDb) {
    return res.status(500).json({ error: 'Unable to load songs database' });
  }
  
  const songInfo = songsDb.songs[songId];
  if (!songInfo) {
    return res.status(404).json({ error: 'Song not found' });
  }
  
  res.json({
    song_id: songId,
    filename: songInfo.filename,
    track_name: songInfo.metadata?.track_name,
    artists_string: songInfo.metadata?.artists_string,
    cover_art_url: songInfo.metadata?.cover_art_url,
    cover_art_filename: songInfo.metadata?.cover_art_filename,
    album_name: songInfo.metadata?.album_name,
    duration_formatted: songInfo.metadata?.duration_formatted,
    playcount: songInfo.metadata?.playcount,
    playlists: songInfo.playlists,
    metadata: songInfo.metadata,
    // Add GitHub URL for direct access
    github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
  });
});

// API: Get detailed song info with metadata (backwards compatibility)
app.get('/song-info/:playlist/:filename', (req, res) => {
  const { playlist, filename } = req.params;
  const songsDb = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
  
  if (!songsDb) {
    return res.json({ 
      filename: filename,
      track_name: filename.replace(/\.[^/.]+$/, ""),
      artists_string: "Unknown Artist",
      cover_art_url: null,
      github_url: `${GITHUB_SONGS_BASE_URL}/${filename}`
    });
  }
  
  // Find song by filename
  let foundSong = null;
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    if (songInfo.filename === filename || songInfo.original_filename === filename) {
      foundSong = songInfo;
    }
  });
  
  if (foundSong) {
    res.json({
      filename: foundSong.filename,
      track_name: foundSong.metadata?.track_name,
      artists_string: foundSong.metadata?.artists_string,
      cover_art_url: foundSong.metadata?.cover_art_url,
      cover_art_filename: foundSong.metadata?.cover_art_filename,
      album_name: foundSong.metadata?.album_name,
      duration_formatted: foundSong.metadata?.duration_formatted,
      playcount: foundSong.metadata?.playcount,
      github_url: `${GITHUB_SONGS_BASE_URL}/${foundSong.filename}`
    });
  } else {
    res.json({ 
      filename: filename,
      track_name: filename.replace(/\.[^/.]+$/, ""),
      artists_string: "Unknown Artist",
      cover_art_url: null,
      github_url: `${GITHUB_SONGS_BASE_URL}/${filename}`
    });
  }
});

// API: Serve songs - now redirects to GitHub
app.get('/songs/:filename', (req, res) => {
  const filename = req.params.filename;
  const githubUrl = `${GITHUB_SONGS_BASE_URL}/${filename}`;
  
  console.log(`Redirecting to GitHub URL: ${githubUrl}`);
  
  // Redirect to GitHub raw URL
  res.redirect(302, githubUrl);
});

// API: Get direct GitHub URL for a song
app.get('/song-url/:filename', (req, res) => {
  const filename = req.params.filename;
  const githubUrl = `${GITHUB_SONGS_BASE_URL}/${filename}`;
  
  res.json({
    filename: filename,
    github_url: githubUrl,
    direct_url: githubUrl
  });
});

// API: Serve cover art images
app.get('/cover_art/:playlist/:filename', (req, res) => {
  const { playlist, filename } = req.params;
  
  // Try different possible locations for cover art
  const possiblePaths = [
    path.join(__dirname, 'public', 'cover_art', playlist, filename),
    path.join(__dirname, 'public', 'songs', playlist, filename),
    path.join(__dirname, 'public', 'consolidated_music', 'cover_art', filename)
  ];
  
  let found = false;
  
  const tryNextPath = (index) => {
    if (index >= possiblePaths.length) {
      if (!found) {
        console.log(`Cover art not found for: ${filename}`);
        return res.status(404).send('Cover art not found');
      }
      return;
    }
    
    const coverArtPath = possiblePaths[index];
    
    fs.access(coverArtPath, fs.constants.F_OK, (err) => {
      if (!err) {
        console.log(`Found cover art: ${coverArtPath}`);
        found = true;
        return res.sendFile(path.resolve(coverArtPath));
      }
      tryNextPath(index + 1);
    });
  };
  
  tryNextPath(0);
});

// API: Search songs across all playlists
app.get('/search', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  const songsDb = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
  
  if (!songsDb || !query) {
    return res.json({ results: [] });
  }
  
  const results = [];
  
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    const trackName = (songInfo.metadata?.track_name || '').toLowerCase();
    const artistsString = (songInfo.metadata?.artists_string || '').toLowerCase();
    const albumName = (songInfo.metadata?.album_name || '').toLowerCase();
    
    if (trackName.includes(query) || artistsString.includes(query) || albumName.includes(query)) {
      results.push({
        song_id: songId,
        filename: songInfo.filename,
        track_name: songInfo.metadata?.track_name,
        artists_string: songInfo.metadata?.artists_string,
        album_name: songInfo.metadata?.album_name,
        cover_art_url: songInfo.metadata?.cover_art_url,
        cover_art_filename: songInfo.metadata?.cover_art_filename,
        playlists: songInfo.playlists,
        // Add GitHub URL
        github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
      });
    }
  });
  
  res.json({
    query: req.query.q,
    total_results: results.length,
    results: results
  });
});

// API: Get statistics
app.get('/stats', (req, res) => {
  const songsDb = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
  const playlistsDb = loadJsonFile(path.join(metadataPath, 'playlists_database.json'));
  
  if (!songsDb || !playlistsDb) {
    return res.status(500).json({ error: 'Unable to load database files' });
  }
  
  // Calculate total original songs (with duplicates)
  let totalOriginalSongs = 0;
  Object.values(playlistsDb.playlists).forEach(playlist => {
    totalOriginalSongs += playlist.total_tracks || 0;
  });
  
  const stats = {
    total_unique_songs: Object.keys(songsDb.songs).length,
    total_playlists: Object.keys(playlistsDb.playlists).length,
    total_original_songs: totalOriginalSongs,
    duplicates_removed: totalOriginalSongs - Object.keys(songsDb.songs).length,
    space_saved_percentage: totalOriginalSongs > 0 ? 
      Math.round(((totalOriginalSongs - Object.keys(songsDb.songs).length) / totalOriginalSongs) * 100) : 0,
    generated_at: songsDb.stats?.generated_at || playlistsDb.stats?.generated_at,
    github_base_url: GITHUB_SONGS_BASE_URL
  };
  
  res.json(stats);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal server error');
});

// Alternative minimal health check (if you prefer simpler response)
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Server is alive'
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('='.repeat(50));
  console.log('CONSOLIDATED MUSIC SERVER (GitHub Integration)');
  console.log('='.repeat(50));
  console.log('API Endpoints:');
  console.log('- GET /playlists - Get all playlists with song counts');
  console.log('- GET /all-songs - Get all unique songs (with GitHub URLs)');
  console.log('- GET /playlist/:playlist/songs - Get songs in a playlist');
  console.log('- GET /song/:songId - Get song info by ID');
  console.log('- GET /search?q=query - Search songs');
  console.log('- GET /stats - Get database statistics');
  console.log('- GET /songs/:filename - Redirect to GitHub song URL');
  console.log('- GET /song-url/:filename - Get direct GitHub URL');
  console.log('- GET /cover_art/:playlist/:filename - Get cover art');
  console.log('');
  console.log('Backwards Compatibility:');
  console.log('- GET /songs - Redirects to /playlists');
  console.log('- GET /metadata/:playlist - Get playlist metadata');
  console.log('- GET /song-info/:playlist/:filename - Get song info');
  console.log('');
  console.log('GitHub Integration:');
  console.log(`- Base URL: ${GITHUB_SONGS_BASE_URL}`);
  console.log('- All song endpoints now include github_url field');
  console.log('- /songs/:filename redirects to GitHub');
  console.log('- Songs served directly from GitHub repository');
  console.log('');
  console.log('Features:');
  console.log('- Consolidated song database with unique IDs');
  console.log('- Deduplication across playlists');
  console.log('- Full-text search functionality');
  console.log('- Playlist relationship tracking');
  console.log('- Statistics and analytics');
  console.log('- Mobile-friendly responsive design');
  console.log('- GitHub-hosted audio files');
  
  // Check if consolidated database exists
  const songsDbPath = path.join(metadataPath, 'songs_database.json');
  const playlistsDbPath = path.join(metadataPath, 'playlists_database.json');
  
  if (!fs.existsSync(songsDbPath) || !fs.existsSync(playlistsDbPath)) {
    console.log('');
    console.log('⚠️  WARNING: Consolidated database files not found!');
    console.log('   Make sure to run the consolidation script first.');
    console.log('   Expected files:');
    console.log(`   - ${songsDbPath}`);
    console.log(`   - ${playlistsDbPath}`);
  } else {
    const songsDb = loadJsonFile(songsDbPath);
    const playlistsDb = loadJsonFile(playlistsDbPath);
    
    if (songsDb && playlistsDb) {
      console.log('');
      console.log('📊 Database Status:');
      console.log(`   - Unique Songs: ${Object.keys(songsDb.songs).length}`);
      console.log(`   - Playlists: ${Object.keys(playlistsDb.playlists).length}`);
      
      // Calculate some basic stats
      let totalOriginalSongs = 0;
      Object.values(playlistsDb.playlists).forEach(playlist => {
        totalOriginalSongs += playlist.total_tracks || 0;
      });
      
      const duplicatesRemoved = totalOriginalSongs - Object.keys(songsDb.songs).length;
      console.log(`   - Duplicates Removed: ${duplicatesRemoved}`);
      console.log(`   - Space Efficiency: ${totalOriginalSongs > 0 ? 
        Math.round(((duplicatesRemoved) / totalOriginalSongs) * 100) : 0}% reduction`);
      console.log(`   - GitHub Base URL: ${GITHUB_SONGS_BASE_URL}`);
    }
  }
});