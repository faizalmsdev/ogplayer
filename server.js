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

// Cache for frequently accessed data
let songsCache = null;
let playlistsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Helper function to load JSON files with caching
function loadJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err);
    return null;
  }
}

// Cache management functions
function isValidCache() {
  return cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION;
}

function loadCachedData() {
  if (!isValidCache()) {
    console.log('Refreshing cache...');
    songsCache = loadJsonFile(path.join(metadataPath, 'songs_database.json'));
    playlistsCache = loadJsonFile(path.join(metadataPath, 'playlists_database.json'));
    cacheTimestamp = Date.now();
  }
  return { songsDb: songsCache, playlistsDb: playlistsCache };
}

// Pagination helper
function paginateArray(array, page = 1, limit = 30) {
  const offset = (page - 1) * limit;
  const paginatedItems = array.slice(offset, offset + limit);
  
  return {
    data: paginatedItems,
    pagination: {
      current_page: page,
      per_page: limit,
      total_items: array.length,
      total_pages: Math.ceil(array.length / limit),
      has_next: offset + limit < array.length,
      has_prev: page > 1
    }
  };
}

// API: Get all playlists with song counts (lightweight)
app.get('/playlists', (req, res) => {
  const { playlistsDb } = loadCachedData();
  
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
      // Don't include songs array here to keep response lightweight
      has_songs: playlistInfo.songs && playlistInfo.songs.length > 0
    };
  });
  
  console.log(`Loaded ${Object.keys(playlists).length} playlists (lightweight)`);
  res.json(playlists);
});

// API: Get paginated songs from all playlists
app.get('/all-songs', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const { songsDb } = loadCachedData();
  
  if (!songsDb) {
    return res.status(500).json({ error: 'Unable to load songs database' });
  }
  
  const allSongs = Object.entries(songsDb.songs).map(([songId, songInfo]) => ({
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
    github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
  }));
  
  const result = paginateArray(allSongs, page, limit);
  
  console.log(`Page ${page}: Loaded ${result.data.length}/${allSongs.length} songs`);
  
  res.json({
    total_songs: allSongs.length,
    songs: result.data,
    pagination: result.pagination
  });
});

// API: Get paginated songs for a specific playlist
app.get('/playlist/:playlist/songs', (req, res) => {
  const playlistName = req.params.playlist;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  
  const { playlistsDb, songsDb } = loadCachedData();
  
  if (!playlistsDb || !songsDb) {
    return res.status(500).json({ error: 'Unable to load database files' });
  }
  
  const playlist = playlistsDb.playlists[playlistName];
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  const allSongsWithMetadata = [];
  
  if (playlist.songs) {
    playlist.songs.forEach(songId => {
      const songInfo = songsDb.songs[songId];
      if (songInfo) {
        allSongsWithMetadata.push({
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
          github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
        });
      }
    });
  }
  
  const result = paginateArray(allSongsWithMetadata, page, limit);
  
  console.log(`Playlist ${playlistName} - Page ${page}: ${result.data.length}/${allSongsWithMetadata.length} songs`);
  
  res.json({
    playlist: playlistName,
    songs: result.data,
    total_songs: allSongsWithMetadata.length,
    unique_songs: playlist.unique_song_count,
    pagination: result.pagination
  });
});

// API: Get specific songs by IDs (for shuffle functionality)
app.get('/songs-by-ids', (req, res) => {
  const songIds = req.query.ids ? req.query.ids.split(',') : [];
  
  if (!songIds.length) {
    return res.json({ songs: [] });
  }
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb) {
    return res.status(500).json({ error: 'Unable to load songs database' });
  }
  
  const songs = [];
  
  songIds.forEach(songId => {
    const songInfo = songsDb.songs[songId.trim()];
    if (songInfo) {
      songs.push({
        song_id: songId.trim(),
        filename: songInfo.filename,
        track_name: songInfo.metadata?.track_name || 'Unknown',
        artists_string: songInfo.metadata?.artists_string || 'Unknown Artist',
        album_name: songInfo.metadata?.album_name,
        duration_formatted: songInfo.metadata?.duration_formatted,
        playcount: songInfo.metadata?.playcount,
        cover_art_url: songInfo.metadata?.cover_art_url,
        cover_art_filename: songInfo.metadata?.cover_art_filename,
        playlists: songInfo.playlists,
        github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
      });
    }
  });
  
  console.log(`Fetched ${songs.length}/${songIds.length} songs by IDs`);
  
  res.json({
    requested_ids: songIds,
    found_songs: songs.length,
    songs: songs
  });
});

// API: Get random song IDs for shuffle (lightweight)
app.get('/random-song-ids', (req, res) => {
  const count = parseInt(req.query.count) || 50;
  const exclude = req.query.exclude ? req.query.exclude.split(',') : [];
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb) {
    return res.status(500).json({ error: 'Unable to load songs database' });
  }
  
  const allSongIds = Object.keys(songsDb.songs).filter(id => !exclude.includes(id));
  
  // Shuffle array and take requested count
  const shuffled = allSongIds.sort(() => 0.5 - Math.random());
  const randomIds = shuffled.slice(0, Math.min(count, shuffled.length));
  
  console.log(`Generated ${randomIds.length} random song IDs`);
  
  res.json({
    count: randomIds.length,
    song_ids: randomIds,
    total_available: allSongIds.length
  });
});

// API: Search songs with pagination
app.get('/search', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb || !query) {
    return res.json({ 
      results: [], 
      pagination: { current_page: 1, per_page: limit, total_items: 0, total_pages: 0 }
    });
  }
  
  const allResults = [];
  
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    const trackName = (songInfo.metadata?.track_name || '').toLowerCase();
    const artistsString = (songInfo.metadata?.artists_string || '').toLowerCase();
    const albumName = (songInfo.metadata?.album_name || '').toLowerCase();
    
    if (trackName.includes(query) || artistsString.includes(query) || albumName.includes(query)) {
      allResults.push({
        song_id: songId,
        filename: songInfo.filename,
        track_name: songInfo.metadata?.track_name,
        artists_string: songInfo.metadata?.artists_string,
        album_name: songInfo.metadata?.album_name,
        cover_art_url: songInfo.metadata?.cover_art_url,
        cover_art_filename: songInfo.metadata?.cover_art_filename,
        playlists: songInfo.playlists,
        github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
      });
    }
  });
  
  const result = paginateArray(allResults, page, limit);
  
  console.log(`Search "${query}" - Page ${page}: ${result.data.length}/${allResults.length} results`);
  
  res.json({
    query: req.query.q,
    total_results: allResults.length,
    results: result.data,
    pagination: result.pagination
  });
});

// API: Get song info by song ID (individual song fetch)
app.get('/song/:songId', (req, res) => {
  const songId = req.params.songId;
  const { songsDb } = loadCachedData();
  
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
    github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
  });
});

// API: Get metadata for a specific playlist (backwards compatibility)
app.get('/metadata/:playlist', (req, res) => {
  const playlistName = req.params.playlist;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  
  const { playlistsDb, songsDb } = loadCachedData();
  
  if (!playlistsDb || !songsDb) {
    return res.status(500).json({ error: 'Unable to load database files' });
  }
  
  const playlist = playlistsDb.playlists[playlistName];
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  // Build download_results format for backwards compatibility
  const allDownloadResults = [];
  
  if (playlist.songs) {
    playlist.songs.forEach(songId => {
      const songInfo = songsDb.songs[songId];
      if (songInfo) {
        allDownloadResults.push({
          track_name: songInfo.metadata?.track_name,
          artists: songInfo.metadata?.artists_string,
          filename: songInfo.filename,
          status: 'success',
          metadata: songInfo.metadata,
          github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`
        });
      }
    });
  }
  
  const result = paginateArray(allDownloadResults, page, limit);
  
  console.log(`Metadata for ${playlistName} - Page ${page}: ${result.data.length}/${allDownloadResults.length} tracks`);
  
  res.json({
    download_info: {
      total_tracks: playlist.total_tracks,
      successful_downloads: playlist.successful_downloads,
      source_url: playlist.source_url,
      timestamp: playlist.timestamp
    },
    download_results: result.data,
    pagination: result.pagination
  });
});

// API: Get detailed song info with metadata (backwards compatibility)
app.get('/song-info/:playlist/:filename', (req, res) => {
  const { playlist, filename } = req.params;
  const { songsDb } = loadCachedData();
  
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

// API: Get statistics (cached)
app.get('/stats', (req, res) => {
  const { songsDb, playlistsDb } = loadCachedData();
  
  if (!songsDb || !playlistsDb) {
    return res.status(500).json({ error: 'Unable to load database files' });
  }
  
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
    github_base_url: GITHUB_SONGS_BASE_URL,
    cache_status: {
      cached: isValidCache(),
      cache_age_minutes: cacheTimestamp ? Math.floor((Date.now() - cacheTimestamp) / 60000) : null
    }
  };
  
  res.json(stats);
});

// Enhanced Search Endpoints - Add these to your existing Express server

// API: Advanced search with multiple filters and sorting
app.get('/search/advanced', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const sortBy = req.query.sort || 'relevance'; // relevance, track_name, artist, album, duration
  const sortOrder = req.query.order || 'asc'; // asc, desc
  const filterBy = req.query.filter || 'all'; // all, track, artist, album
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb || !query) {
    return res.json({ 
      query: req.query.q || '',
      total_results: 0,
      results: [], 
      pagination: { current_page: 1, per_page: limit, total_items: 0, total_pages: 0 },
      search_info: {
        filter_applied: filterBy,
        sort_by: sortBy,
        sort_order: sortOrder
      }
    });
  }
  
  const allResults = [];
  
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    const trackName = (songInfo.metadata?.track_name || '').toLowerCase();
    const artistsString = (songInfo.metadata?.artists_string || '').toLowerCase();
    const albumName = (songInfo.metadata?.album_name || '').toLowerCase();
    const filename = (songInfo.filename || '').toLowerCase();
    
    let matches = false;
    let relevanceScore = 0;
    
    // Apply filter-based search
    switch (filterBy) {
      case 'track':
        matches = trackName.includes(query) || filename.includes(query);
        if (trackName.startsWith(query)) relevanceScore += 10;
        if (trackName.includes(query)) relevanceScore += 5;
        break;
      case 'artist':
        matches = artistsString.includes(query);
        if (artistsString.startsWith(query)) relevanceScore += 10;
        if (artistsString.includes(query)) relevanceScore += 5;
        break;
      case 'album':
        matches = albumName.includes(query);
        if (albumName.startsWith(query)) relevanceScore += 10;
        if (albumName.includes(query)) relevanceScore += 5;
        break;
      default: // 'all'
        matches = trackName.includes(query) || artistsString.includes(query) || 
                 albumName.includes(query) || filename.includes(query);
        
        // Calculate relevance score for comprehensive search
        if (trackName.startsWith(query)) relevanceScore += 15;
        else if (trackName.includes(query)) relevanceScore += 10;
        
        if (artistsString.startsWith(query)) relevanceScore += 12;
        else if (artistsString.includes(query)) relevanceScore += 8;
        
        if (albumName.startsWith(query)) relevanceScore += 8;
        else if (albumName.includes(query)) relevanceScore += 5;
        
        if (filename.includes(query)) relevanceScore += 3;
        break;
    }
    
    if (matches) {
      allResults.push({
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
        github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`,
        relevance_score: relevanceScore
      });
    }
  });
  
  // Sort results based on sortBy parameter
  allResults.sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'track_name':
        compareValue = (a.track_name || '').localeCompare(b.track_name || '');
        break;
      case 'artist':
        compareValue = (a.artists_string || '').localeCompare(b.artists_string || '');
        break;
      case 'album':
        compareValue = (a.album_name || '').localeCompare(b.album_name || '');
        break;
      case 'duration':
        const aDuration = parseDuration(a.duration_formatted);
        const bDuration = parseDuration(b.duration_formatted);
        compareValue = aDuration - bDuration;
        break;
      case 'playcount':
        compareValue = (a.playcount || 0) - (b.playcount || 0);
        break;
      default: // 'relevance'
        compareValue = b.relevance_score - a.relevance_score;
        break;
    }
    
    return sortOrder === 'desc' ? -compareValue : compareValue;
  });
  
  const result = paginateArray(allResults, page, limit);
  
  console.log(`Advanced Search "${query}" (${filterBy}) - Page ${page}: ${result.data.length}/${allResults.length} results`);
  
  res.json({
    query: req.query.q,
    total_results: allResults.length,
    results: result.data,
    pagination: result.pagination,
    search_info: {
      filter_applied: filterBy,
      sort_by: sortBy,
      sort_order: sortOrder,
      search_time: Date.now()
    }
  });
});

// Helper function to parse duration string to seconds for sorting
function parseDuration(durationStr) {
  if (!durationStr) return 0;
  const parts = durationStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } else if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  return 0;
}

// API: Quick search (lightweight, returns minimal data for autocomplete)
app.get('/search/quick', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  const limit = parseInt(req.query.limit) || 10;
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb || !query || query.length < 2) {
    return res.json({ 
      suggestions: [],
      query: req.query.q || ''
    });
  }
  
  const suggestions = [];
  const seen = new Set();
  
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    if (suggestions.length >= limit) return;
    
    const trackName = songInfo.metadata?.track_name || '';
    const artistsString = songInfo.metadata?.artists_string || '';
    
    // Check track name matches
    if (trackName.toLowerCase().includes(query)) {
      const suggestion = `${trackName} - ${artistsString}`;
      if (!seen.has(suggestion)) {
        suggestions.push({
          type: 'track',
          text: suggestion,
          track_name: trackName,
          artist: artistsString,
          song_id: songId
        });
        seen.add(suggestion);
      }
    }
    
    // Check artist matches (separate suggestions)
    if (artistsString.toLowerCase().includes(query) && suggestions.length < limit) {
      if (!seen.has(artistsString)) {
        suggestions.push({
          type: 'artist',
          text: artistsString,
          artist: artistsString
        });
        seen.add(artistsString);
      }
    }
  });
  
  console.log(`Quick search "${query}": ${suggestions.length} suggestions`);
  
  res.json({
    query: req.query.q,
    suggestions: suggestions.slice(0, limit)
  });
});

// API: Search by specific field with exact and partial matches
app.get('/search/by-field', (req, res) => {
  const field = req.query.field || 'track_name'; // track_name, artists_string, album_name
  const query = req.query.q?.toLowerCase() || '';
  const matchType = req.query.match || 'partial'; // exact, partial, starts_with
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb || !query) {
    return res.json({ 
      field: field,
      query: req.query.q || '',
      match_type: matchType,
      total_results: 0,
      results: [], 
      pagination: { current_page: 1, per_page: limit, total_items: 0, total_pages: 0 }
    });
  }
  
  const allResults = [];
  
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    let fieldValue = '';
    
    switch (field) {
      case 'artists_string':
        fieldValue = (songInfo.metadata?.artists_string || '').toLowerCase();
        break;
      case 'album_name':
        fieldValue = (songInfo.metadata?.album_name || '').toLowerCase();
        break;
      default: // 'track_name'
        fieldValue = (songInfo.metadata?.track_name || '').toLowerCase();
        break;
    }
    
    let matches = false;
    
    switch (matchType) {
      case 'exact':
        matches = fieldValue === query;
        break;
      case 'starts_with':
        matches = fieldValue.startsWith(query);
        break;
      default: // 'partial'
        matches = fieldValue.includes(query);
        break;
    }
    
    if (matches) {
      allResults.push({
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
        github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`,
        matched_field: field,
        matched_value: fieldValue
      });
    }
  });
  
  // Sort alphabetically by the searched field
  allResults.sort((a, b) => {
    const aValue = a[field] || '';
    const bValue = b[field] || '';
    return aValue.localeCompare(bValue);
  });
  
  const result = paginateArray(allResults, page, limit);
  
  console.log(`Field Search "${query}" in ${field} (${matchType}) - Page ${page}: ${result.data.length}/${allResults.length} results`);
  
  res.json({
    field: field,
    query: req.query.q,
    match_type: matchType,
    total_results: allResults.length,
    results: result.data,
    pagination: result.pagination
  });
});

// API: Get all unique values for a specific field (for filters/dropdowns)
app.get('/search/field-values/:field', (req, res) => {
  const field = req.params.field; // artists_string, album_name, playlists
  const { songsDb } = loadCachedData();
  
  if (!songsDb) {
    return res.status(500).json({ error: 'Unable to load songs database' });
  }
  
  const uniqueValues = new Set();
  
  Object.values(songsDb.songs).forEach(songInfo => {
    let value = '';
    
    switch (field) {
      case 'artists_string':
        value = songInfo.metadata?.artists_string;
        break;
      case 'album_name':
        value = songInfo.metadata?.album_name;
        break;
      case 'playlists':
        if (songInfo.playlists && Array.isArray(songInfo.playlists)) {
          songInfo.playlists.forEach(playlist => uniqueValues.add(playlist));
        }
        return; // Skip the main add below
      default:
        return res.status(400).json({ error: 'Invalid field. Use: artists_string, album_name, or playlists' });
    }
    
    if (value && value.trim()) {
      uniqueValues.add(value.trim());
    }
  });
  
  const sortedValues = Array.from(uniqueValues).sort();
  
  console.log(`Field values for ${field}: ${sortedValues.length} unique values`);
  
  res.json({
    field: field,
    total_unique: sortedValues.length,
    values: sortedValues
  });
});

// API: Multi-field search (search across multiple fields simultaneously)
app.get('/search/multi', (req, res) => {
  const trackQuery = req.query.track?.toLowerCase() || '';
  const artistQuery = req.query.artist?.toLowerCase() || '';
  const albumQuery = req.query.album?.toLowerCase() || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb || (!trackQuery && !artistQuery && !albumQuery)) {
    return res.json({ 
      queries: { track: req.query.track || '', artist: req.query.artist || '', album: req.query.album || '' },
      total_results: 0,
      results: [], 
      pagination: { current_page: 1, per_page: limit, total_items: 0, total_pages: 0 }
    });
  }
  
  const allResults = [];
  
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    const trackName = (songInfo.metadata?.track_name || '').toLowerCase();
    const artistsString = (songInfo.metadata?.artists_string || '').toLowerCase();
    const albumName = (songInfo.metadata?.album_name || '').toLowerCase();
    
    let matches = true;
    let matchScore = 0;
    
    // All specified queries must match
    if (trackQuery && !trackName.includes(trackQuery)) {
      matches = false;
    } else if (trackQuery && trackName.includes(trackQuery)) {
      matchScore += trackName.startsWith(trackQuery) ? 3 : 1;
    }
    
    if (artistQuery && !artistsString.includes(artistQuery)) {
      matches = false;
    } else if (artistQuery && artistsString.includes(artistQuery)) {
      matchScore += artistsString.startsWith(artistQuery) ? 3 : 1;
    }
    
    if (albumQuery && !albumName.includes(albumQuery)) {
      matches = false;
    } else if (albumQuery && albumName.includes(albumQuery)) {
      matchScore += albumName.startsWith(albumQuery) ? 3 : 1;
    }
    
    if (matches) {
      allResults.push({
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
        github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`,
        match_score: matchScore
      });
    }
  });
  
  // Sort by match score (highest first)
  allResults.sort((a, b) => b.match_score - a.match_score);
  
  const result = paginateArray(allResults, page, limit);
  
  console.log(`Multi-field Search - Page ${page}: ${result.data.length}/${allResults.length} results`);
  
  res.json({
    queries: { 
      track: req.query.track || '', 
      artist: req.query.artist || '', 
      album: req.query.album || '' 
    },
    total_results: allResults.length,
    results: result.data,
    pagination: result.pagination
  });
});

// Update the existing /search endpoint to be more comprehensive
app.get('/search', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  
  const { songsDb } = loadCachedData();
  
  if (!songsDb || !query) {
    return res.json({ 
      query: req.query.q || '',
      total_results: 0,
      results: [], 
      pagination: { current_page: 1, per_page: limit, total_items: 0, total_pages: 0 }
    });
  }
  
  const allResults = [];
  const queryTerms = query.split(' ').filter(term => term.length > 0);
  
  Object.entries(songsDb.songs).forEach(([songId, songInfo]) => {
    const trackName = (songInfo.metadata?.track_name || '').toLowerCase();
    const artistsString = (songInfo.metadata?.artists_string || '').toLowerCase();
    const albumName = (songInfo.metadata?.album_name || '').toLowerCase();
    const filename = (songInfo.filename || '').toLowerCase();
    
    // Check if all query terms match in any field
    const allFieldsText = `${trackName} ${artistsString} ${albumName} ${filename}`;
    const matchesAllTerms = queryTerms.every(term => allFieldsText.includes(term));
    
    if (matchesAllTerms) {
      // Calculate relevance score
      let relevanceScore = 0;
      
      queryTerms.forEach(term => {
        if (trackName.includes(term)) relevanceScore += trackName.startsWith(term) ? 10 : 5;
        if (artistsString.includes(term)) relevanceScore += artistsString.startsWith(term) ? 8 : 4;
        if (albumName.includes(term)) relevanceScore += albumName.startsWith(term) ? 6 : 3;
        if (filename.includes(term)) relevanceScore += 2;
      });
      
      allResults.push({
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
        github_url: `${GITHUB_SONGS_BASE_URL}/${songInfo.filename}`,
        relevance_score: relevanceScore
      });
    }
  });
  
  // Sort by relevance score (highest first)
  allResults.sort((a, b) => b.relevance_score - a.relevance_score);
  
  const result = paginateArray(allResults, page, limit);
  
  console.log(`Enhanced Search "${query}" - Page ${page}: ${result.data.length}/${allResults.length} results`);
  
  res.json({
    query: req.query.q,
    total_results: allResults.length,
    results: result.data,
    pagination: result.pagination,
    search_terms: queryTerms
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal server error');
});

// Health check
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Server is alive',
    cache_status: isValidCache() ? 'active' : 'expired'
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('='.repeat(50));
  console.log('OPTIMIZED MUSIC SERVER (Pagination + Caching)');
  console.log('='.repeat(50));
  console.log('Performance Features:');
  console.log('- 🚀 Pagination (default: 30 items per page)');
  console.log('- 🔄 In-memory caching (5-minute TTL)');
  console.log('- ⚡ Lazy loading support');
  console.log('- 🎲 Efficient shuffle with ID-based fetching');
  console.log('- 📱 Mobile-optimized responses');
  console.log('');
  console.log('Paginated API Endpoints:');
  console.log('- GET /all-songs?page=1&limit=30 - Paginated all songs');
  console.log('- GET /playlist/:playlist/songs?page=1&limit=30 - Paginated playlist songs');
  console.log('- GET /search?q=query&page=1&limit=30 - Paginated search results');
  console.log('- GET /metadata/:playlist?page=1&limit=30 - Paginated metadata');
  console.log('');
  console.log('Shuffle Optimization:');
  console.log('- GET /random-song-ids?count=50&exclude=id1,id2 - Get random song IDs');
  console.log('- GET /songs-by-ids?ids=id1,id2,id3 - Fetch specific songs by IDs');
  console.log('');
  console.log('Standard Endpoints:');
  console.log('- GET /playlists - Get all playlists (lightweight)');
  console.log('- GET /song/:songId - Get individual song info');
  console.log('- GET /stats - Get database statistics (cached)');
  console.log('- GET /songs/:filename - Redirect to GitHub song URL');
  
  // Initialize cache on startup
  loadCachedData();
  
  const { songsDb, playlistsDb } = loadCachedData();
  if (songsDb && playlistsDb) {
    console.log('');
    console.log('📊 Database Status (Cached):');
    console.log(`   - Unique Songs: ${Object.keys(songsDb.songs).length}`);
    console.log(`   - Playlists: ${Object.keys(playlistsDb.playlists).length}`);
    console.log(`   - Cache Duration: ${CACHE_DURATION / 60000} minutes`);
    console.log(`   - Default Page Size: 30 items`);
    console.log('');
    console.log('💡 Usage Tips:');
    console.log('   - Use pagination for large datasets');
    console.log('   - Implement infinite scroll on frontend');
    console.log('   - Cache is auto-refreshed every 5 minutes');
    console.log('   - Use /random-song-ids for efficient shuffle');
  }
});