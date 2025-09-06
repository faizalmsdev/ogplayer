# CORS/ORB Error Troubleshooting Guide

## Problem: net::ERR_BLOCKED_BY_ORB

The `net::ERR_BLOCKED_BY_ORB` (Opaque Response Blocking) error occurs when browsers block cross-origin media requests for security reasons.

## What Was Fixed

### 1. Enhanced CORS Headers
```javascript
// Added comprehensive CORS headers
res.header('Access-Control-Allow-Origin', '*');
res.header('Access-Control-Allow-Headers', 'Range, Authorization');
res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
res.header('Cross-Origin-Resource-Policy', 'cross-origin');
res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
```

### 2. Stream Proxying Instead of Redirects
- **Before**: Server redirected to YouTube URLs → CORS error
- **After**: Server proxies the stream → No CORS issues

### 3. Proper Media Headers
```javascript
// Added proper media streaming headers
res.setHeader('Accept-Ranges', 'bytes');
res.setHeader('Content-Type', proxyRes.headers['content-type']);
res.setHeader('Content-Length', proxyRes.headers['content-length']);
```

### 4. Audio Element Improvements
```html
<!-- Added CORS attributes -->
<audio crossorigin="anonymous" preload="none">
```

## How It Works Now

1. **Client Request**: Browser requests `/api/stream/VIDEO_ID`
2. **Server Processing**: 
   - Extracts YouTube stream URL using yt-dlp
   - Caches the URL for performance
3. **Proxy Response**: 
   - Server fetches the actual stream from YouTube
   - Adds proper CORS headers
   - Streams data back to client
4. **Browser**: Receives stream with proper headers → No CORS error

## Testing the Fix

### 1. Check CORS Headers
```bash
curl -I "http://your-server:3001/api/stream/VIDEO_ID"
```

Should return headers like:
```
Access-Control-Allow-Origin: *
Cross-Origin-Resource-Policy: cross-origin
Accept-Ranges: bytes
Content-Type: audio/webm
```

### 2. Test Direct Stream URL (Alternative)
```bash
curl "http://your-server:3001/api/stream-url/VIDEO_ID"
```

Returns JSON with direct YouTube URL for debugging.

### 3. Browser Console
- Open F12 Developer Tools
- Check Console for errors
- Network tab should show successful audio requests

## Alternative Solutions (If Issues Persist)

### Option 1: Use Direct URLs
Modify frontend to use `/api/stream-url/` endpoint:
```javascript
fetch(`/api/stream-url/${song.id}`)
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      audio.src = data.streamUrl; // Direct YouTube URL
    }
  });
```

### Option 2: Download and Serve
For problematic videos, download and serve locally:
```bash
yt-dlp -f bestaudio -o "downloads/%(id)s.%(ext)s" "VIDEO_URL"
```

### Option 3: Use Different Player
Switch to a more permissive audio player:
```html
<video controls>
  <source src="/api/stream/VIDEO_ID" type="audio/webm">
  <source src="/api/stream/VIDEO_ID" type="audio/mp4">
</video>
```

## Deployment Checklist

- [ ] ✅ Updated `simple-server.js` with CORS fixes
- [ ] ✅ Updated `simple.html` with crossorigin attribute
- [ ] ✅ Uploaded cookies file to server
- [ ] ✅ Updated yt-dlp to latest version
- [ ] ✅ Tested streaming endpoint
- [ ] ✅ Checked browser console for errors

## Common Issues

### 1. Still Getting CORS Errors
- Ensure you're using the updated server code
- Check that cookies are properly uploaded
- Verify yt-dlp is latest version

### 2. Slow Streaming
- YouTube stream URLs are cached for 10 minutes
- First request may be slower due to extraction
- Consider increasing cache duration

### 3. Some Videos Don't Work
- Age-restricted content may not work
- Region-locked videos require VPN
- Private/deleted videos will fail

### 4. Server Memory Issues
- Proxying uses server bandwidth and memory
- Consider using direct URLs for high traffic
- Implement rate limiting if needed

## Monitoring

### Log Important Events
```javascript
// Added logging throughout the codebase
console.log('🍪 Using cookies file for authentication');
console.log('✅ Stream URL obtained using format: bestaudio');
console.log('🎵 Proxying stream for:', videoId);
```

### Health Check
```bash
# Check if server is responding
curl "http://your-server:3001/api/cookies-status"

# Test a known working video
curl -I "http://your-server:3001/api/stream/dQw4w9WgXcQ"
```

## Performance Optimization

### 1. Enable Gzip Compression
```javascript
app.use(require('compression')());
```

### 2. Implement Response Caching
```javascript
app.use('/api/stream', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=600'); // 10 minutes
  next();
});
```

### 3. Use CDN (Optional)
For high traffic, consider using a CDN to cache streams.

## Security Considerations

- CORS is set to `*` for maximum compatibility
- Consider restricting origins in production:
  ```javascript
  res.header('Access-Control-Allow-Origin', 'https://yourdomain.com');
  ```
- Cookies contain sensitive session data - keep secure
- Consider rate limiting to prevent abuse

---

## Quick Fix Summary

The main fix was changing from **redirect-based streaming** to **proxy-based streaming** with proper CORS headers. This prevents browsers from blocking the media requests while maintaining compatibility with YouTube's anti-bot measures through cookie authentication.
