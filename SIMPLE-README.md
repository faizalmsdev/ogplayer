# Simple YouTube Music Server

A lightweight music server that streams music directly from YouTube using `yt-dlp`, similar to yewtube functionality.

## Features

- 🔍 **Search YouTube music** - Find any song on YouTube
- 🎵 **Direct streaming** - Stream music without downloading
- 📱 **Real-time sync** - Multi-user rooms with synchronized playback
- 🚀 **No metadata required** - Works instantly without databases
- 💫 **Simple interface** - Clean, responsive web player

## Prerequisites

1. **Install yt-dlp**:
   ```bash
   pip install yt-dlp
   ```
   Or download from: https://github.com/yt-dlp/yt-dlp

2. **Install Node.js dependencies**:
   ```bash
   npm install express socket.io
   ```

## Quick Start

1. **Start the server**:
   ```bash
   node simple-server.js
   ```

2. **Open your browser**:
   ```
   http://localhost:3001/simple.html
   ```

3. **Search and play music**:
   - Enter any song name or artist
   - Click "Search" to find music
   - Click "Play" to stream instantly
   - Use "Queue" to add songs to playlist

## API Endpoints

### Search Music
```
GET /api/search?q=query&limit=10
```
Returns JSON with search results from YouTube.

### Stream Music
```
GET /api/stream/:videoId
```
Redirects to the actual audio stream URL.

### Get Video Info
```
GET /api/info/:videoId
```
Returns detailed information about a YouTube video.

## Room Features

- Join different rooms for synchronized listening
- Real-time queue management
- Multiple users can control the same room
- Auto-play next song from queue

## Example Usage

### Search for music:
```javascript
fetch('/api/search?q=imagine%20dragons%20believer')
  .then(res => res.json())
  .then(data => console.log(data.results));
```

### Play a song:
```javascript
// Get the stream URL and play
const audioElement = new Audio('/api/stream/VIDEO_ID');
audioElement.play();
```

## Advantages over GitHub-based approach

1. **No storage needed** - Streams directly from YouTube
2. **Always up-to-date** - Access to latest music
3. **Unlimited library** - Entire YouTube music catalog
4. **No metadata management** - yt-dlp handles everything
5. **Legal streaming** - Uses YouTube's official streams

## Technical Details

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: Vanilla JavaScript + Socket.IO client
- **Streaming**: yt-dlp extracts direct audio URLs
- **Caching**: 10-minute cache for search results and stream URLs
- **Real-time**: WebSocket-based room synchronization

## Configuration

You can modify these settings in `simple-server.js`:

```javascript
const PORT = 3001;                    // Server port
const CACHE_DURATION = 10 * 60 * 1000; // Cache duration (10 minutes)
```

## Troubleshooting

### yt-dlp not found
```bash
# Install yt-dlp
pip install yt-dlp

# Or install globally
pip install --upgrade yt-dlp
```

### Permission errors
Make sure yt-dlp is in your system PATH or install it globally.

### Slow search/streaming
- yt-dlp might be slow on first run
- Results are cached for 10 minutes
- Consider increasing cache duration for better performance

## Comparison with Original Server

| Feature | Original Server | Simple Server |
|---------|----------------|---------------|
| Storage | GitHub repository | None required |
| Metadata | JSON databases | yt-dlp extracts |
| Setup | Complex | Minimal |
| Music Library | Limited to uploaded | Entire YouTube |
| Updates | Manual | Automatic |
| Legal | Depends on uploads | Uses YouTube streams |

## License

MIT License - Feel free to use and modify!
