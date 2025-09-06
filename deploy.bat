@echo off
echo 🚀 Deploying YouTube Music Server with CORS fixes...
echo ==================================================

:: Check if we're in the right directory
if not exist "simple-server.js" (
    echo ❌ Error: simple-server.js not found in current directory
    echo Please run this script from the ogplayer directory
    pause
    exit /b 1
)

:: Update yt-dlp to latest version
echo 🔄 Updating yt-dlp...
yt-dlp -U 2>nul || pip install -U yt-dlp 2>nul || pip3 install -U yt-dlp 2>nul || python -m pip install yt-dlp

:: Install Node.js dependencies
echo 📦 Installing Node.js dependencies...
npm install

:: Check if cookies file exists
if exist "youtube_cookies.txt" (
    echo ✅ Cookies file found: youtube_cookies.txt
    for %%A in ("youtube_cookies.txt") do echo 📏 Size: %%~zA bytes
) else (
    echo ⚠️ No cookies file found. You may need to upload cookies for server use.
    echo Use the web interface at /cookies.html or extract cookies locally.
)

:: Test the server
echo 🧪 Testing server configuration...
node -c simple-server.js
if errorlevel 1 (
    echo ❌ Server configuration has errors
    pause
    exit /b 1
) else (
    echo ✅ Server configuration is valid
)

:: Start the server
echo.
echo 🎵 Starting the YouTube Music Server...
echo Server will be available at: http://your-server-ip:3001
echo.
echo Available endpoints:
echo   🏠 Main interface: /
echo   🔍 Search: /api/search?q=query
echo   🎵 Stream: /api/stream/:videoId
echo   🍪 Cookie manager: /cookies.html
echo   ℹ️ Video info: /api/info/:videoId
echo   📊 Cookies status: /api/cookies-status
echo.
echo 🔧 Fixes applied:
echo   ✅ Enhanced CORS headers for media streaming
echo   ✅ Stream proxying to avoid ORB errors
echo   ✅ Cookie support for YouTube authentication
echo   ✅ Multiple format fallback strategies
echo   ✅ Better error handling and retry logic
echo   ✅ Updated yt-dlp with latest YouTube fixes
echo.
echo Press Ctrl+C to stop the server
echo.

:: Start the server
node simple-server.js

pause
