# Quick Fix: Upload Cookies to Server

## The Problem
Your server is showing: **"Sign in to confirm you're not a bot"**
This means yt-dlp needs cookies for authentication.

## Quick Solution

### Option 1: Web Interface Upload (Easiest)

1. **Copy your local cookies file content:**
   ```bash
   # On Windows PowerShell:
   Get-Content youtube_cookies.txt | Set-Clipboard
   
   # On Windows Command Prompt:
   type youtube_cookies.txt | clip
   
   # On Linux/Mac:
   cat youtube_cookies.txt | pbcopy
   ```

2. **Open your server's cookie manager:**
   ```
   http://209.74.95.163:3001/cookies.html
   ```

3. **Paste the cookies content and click "Upload Cookies"**

### Option 2: Direct File Transfer

#### Using SCP (Linux/Mac/WSL):
```bash
scp youtube_cookies.txt prasanth@209.74.95.163:/home/prasanth/ogplayer/
```

#### Using PowerShell (Windows 10/11):
```powershell
scp youtube_cookies.txt prasanth@209.74.95.163:/home/prasanth/ogplayer/
```

#### Using WinSCP/FileZilla (Windows):
- Host: 209.74.95.163
- Username: prasanth
- Upload `youtube_cookies.txt` to `/home/prasanth/ogplayer/`

### Option 3: Copy-Paste via SSH

1. **SSH to your server:**
   ```bash
   ssh prasanth@209.74.95.163
   cd /home/prasanth/ogplayer
   ```

2. **Create cookies file:**
   ```bash
   nano youtube_cookies.txt
   ```

3. **Paste your cookies content and save (Ctrl+X, Y, Enter)**

## Test the Fix

After uploading cookies, test on your server:

```bash
# Test if cookies work
yt-dlp --cookies youtube_cookies.txt --get-title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Test your original failing command
yt-dlp --cookies youtube_cookies.txt -f bestaudio -o - https://www.youtube.com/watch?v=-WVDfHUVym4
```

## Your Cookies File Content

Your local `youtube_cookies.txt` should look like this:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1999999999	session_token	YOUR_TOKEN_HERE
.youtube.com	TRUE	/	FALSE	1999999999	VISITOR_INFO1_LIVE	YOUR_INFO_HERE
... (more cookie entries)
```

## Start Updated Server

After cookies are uploaded:
```bash
cd /home/prasanth/ogplayer
node simple-server.js
```

The server will automatically detect and use the cookies file!

## Verification

Check cookies status via API:
```bash
curl http://209.74.95.163:3001/api/cookies-status
```

Should return:
```json
{
  "hasCookies": true,
  "cookiesFile": "/path/to/youtube_cookies.txt",
  "lastModified": "2025-09-06T...",
  "size": 748
}
```

## If Still Not Working

1. **Refresh cookies** - extract new ones from your browser
2. **Check file permissions** - `chmod 644 youtube_cookies.txt`
3. **Update yt-dlp** - `pip install -U yt-dlp`
4. **Check server logs** for authentication errors

The key is getting those cookies from your local machine (where you're logged into YouTube) to your server!
