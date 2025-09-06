# YouTube Cookies Setup for Server

This guide helps you set up YouTube cookies to bypass streaming restrictions on your server.

## Why Cookies Are Needed

When running on a server, YouTube often blocks requests due to:
- Automated bot detection
- Missing browser session data
- Server IP reputation
- Geographic restrictions

Cookies from a logged-in browser session help bypass these restrictions.

## Method 1: Automatic Cookie Extraction (Recommended)

### Prerequisites
- Browser with YouTube login
- yt-dlp installed

### Steps
1. Run the cookie extraction script:
   ```bash
   node extract-cookies.js
   ```

2. The script will attempt to extract cookies from:
   - Chrome
   - Firefox
   - Safari
   - Edge
   - Opera

3. If successful, cookies will be saved to `youtube_cookies.txt`

## Method 2: Browser Extension

### Chrome Users
1. Install "Get cookies.txt LOCALLY" extension
2. Go to YouTube.com and log in
3. Click the extension icon
4. Select "Export for youtube.com"
5. Save the file as `youtube_cookies.txt`

### Firefox Users
1. Install "cookies.txt" add-on
2. Go to YouTube.com and log in
3. Click the add-on icon
4. Export cookies for youtube.com
5. Save as `youtube_cookies.txt`

## Method 3: Manual Extraction

### Using Browser Developer Tools
1. Open YouTube.com in your browser
2. Log in to your account
3. Press F12 to open Developer Tools
4. Go to Application → Storage → Cookies
5. Select https://www.youtube.com
6. Copy important cookies:
   - session_token
   - VISITOR_INFO1_LIVE
   - LOGIN_INFO
   - SID, HSID, SSID
   - APISID, SAPISID

### Format the cookies file
Create `youtube_cookies.txt` with this format:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1999999999	session_token	YOUR_SESSION_TOKEN
.youtube.com	TRUE	/	FALSE	1999999999	VISITOR_INFO1_LIVE	YOUR_VISITOR_INFO
.youtube.com	TRUE	/	TRUE	1999999999	LOGIN_INFO	YOUR_LOGIN_INFO
.youtube.com	TRUE	/	FALSE	1999999999	PREF	YOUR_PREFERENCES
.youtube.com	TRUE	/	TRUE	1999999999	SID	YOUR_SID
.youtube.com	TRUE	/	TRUE	1999999999	HSID	YOUR_HSID
.youtube.com	TRUE	/	TRUE	1999999999	SSID	YOUR_SSID
.youtube.com	TRUE	/	TRUE	1999999999	APISID	YOUR_APISID
.youtube.com	TRUE	/	TRUE	1999999999	SAPISID	YOUR_SAPISID
```

## Method 4: Web Interface

1. Start your server: `node simple-server.js`
2. Open: http://your-server:3001/cookies.html
3. Follow the instructions on the page
4. Upload cookies via the web interface

## Deployment to Server

### Option 1: Upload via Web Interface
1. Access: http://your-server:3001/cookies.html
2. Paste cookies content
3. Click "Upload Cookies"

### Option 2: API Upload
```bash
curl -X POST http://your-server:3001/api/upload-cookies \
  -H "Content-Type: text/plain" \
  --data-binary @youtube_cookies.txt
```

### Option 3: SCP/SFTP
```bash
scp youtube_cookies.txt user@your-server:/path/to/ogplayer/
```

## Verification

Check if cookies are working:
```bash
curl http://your-server:3001/api/cookies-status
```

Test streaming a video:
```bash
curl "http://your-server:3001/api/stream/VIDEO_ID"
```

## Troubleshooting

### Cookies Not Working
1. Ensure you're logged into YouTube when extracting
2. Try extracting from a different browser
3. Check cookie file format
4. Update yt-dlp: `yt-dlp -U`

### Server Still Blocked
1. Use a VPN on your server
2. Try different user agents
3. Add proxy support:
   ```bash
   export HTTP_PROXY=http://proxy:port
   ```

### Cookie Expiration
- Cookies expire over time
- Re-extract every few weeks
- Monitor server logs for auth errors

## Security Notes

- Keep cookies file secure (contains session data)
- Don't share cookies publicly
- Regularly update cookies
- Use environment variables for production:
  ```bash
  export COOKIES_FILE=/secure/path/youtube_cookies.txt
  ```

## Environment Variables

```bash
# Optional proxy support
export HTTP_PROXY=http://proxy:8080
export HTTPS_PROXY=http://proxy:8080

# Custom cookies location
export COOKIES_FILE=/path/to/cookies.txt
```

## API Endpoints

- `GET /api/cookies-status` - Check cookies status
- `POST /api/upload-cookies` - Upload cookies (text/plain)
- `DELETE /api/cookies` - Delete cookies file
- `GET /cookies.html` - Web interface
