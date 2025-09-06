# Package Cleanup Analysis

## Current package.json dependencies:
```json
{
  "cors": "^2.8.5",           // ❌ NOT USED - Can be removed
  "dotenv": "^17.2.2",        // ✅ USED by simple-server.js  
  "express": "^5.1.0",        // ✅ USED by both servers
  "node-fetch": "^3.3.2",     // ✅ USED by simple-server.js (Spotify API)
  "socket.io": "^4.8.1"       // ✅ USED by both servers
}
```

## Recommended Actions:

### 1. Safe to Remove:
- **`cors` package** - Neither server imports it directly
  - Both servers handle CORS with manual headers
  - Socket.io has built-in CORS configuration

### 2. Keep These (Actually Used):
- **`express`** - Core web framework for both servers
- **`socket.io`** - Real-time features for both servers  
- **`dotenv`** - Environment variables in simple-server.js
- **`node-fetch`** - Spotify API calls in simple-server.js

### 3. Optional Considerations:

**If you don't use Spotify features:**
- Could remove `node-fetch` and `dotenv`
- Simple-server.js would still work for YouTube-only functionality

**If you only use one server:**
- If using only `simple-server.js`: Keep all except `cors`
- If using only `server.js`: Could remove `node-fetch` and `dotenv`

## Updated package.json (minimal):
```json
{
  "name": "ogplayer",
  "version": "1.0.0", 
  "main": "simple-server.js",
  "scripts": {
    "start": "node simple-server.js",
    "legacy": "node server.js"
  },
  "dependencies": {
    "dotenv": "^17.2.2",
    "express": "^5.1.0", 
    "node-fetch": "^3.3.2",
    "socket.io": "^4.8.1"
  }
}
```

## Command to remove unused package:
```bash
npm uninstall cors
```

This will save space and reduce dependency bloat!
