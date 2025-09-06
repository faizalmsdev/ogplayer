#!/bin/bash

# YouTube Music Server Deployment Script
# This script deploys the updated server with CORS fixes

echo "🚀 Deploying YouTube Music Server with CORS fixes..."
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "simple-server.js" ]; then
    echo "❌ Error: simple-server.js not found in current directory"
    echo "Please run this script from the ogplayer directory"
    exit 1
fi

# Update yt-dlp to latest version
echo "🔄 Updating yt-dlp..."
if command -v yt-dlp &> /dev/null; then
    yt-dlp -U || pip install -U yt-dlp || pip3 install -U yt-dlp
else
    echo "Installing yt-dlp..."
    pip install yt-dlp || pip3 install yt-dlp || python -m pip install yt-dlp
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Check if cookies file exists
if [ -f "youtube_cookies.txt" ]; then
    echo "✅ Cookies file found: youtube_cookies.txt"
    echo "📏 Size: $(wc -c < youtube_cookies.txt) bytes"
else
    echo "⚠️ No cookies file found. You may need to upload cookies for server use."
    echo "Use the web interface at /cookies.html or extract cookies locally."
fi

# Create a systemd service file (optional)
echo "🔧 Creating systemd service file..."
cat > ogplayer.service << EOF
[Unit]
Description=OG Music Player Server
After=network.target

[Service]
Type=simple
User=\$(whoami)
WorkingDirectory=\$(pwd)
ExecStart=\$(which node) simple-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "📄 Service file created: ogplayer.service"
echo "To install as system service, run:"
echo "  sudo cp ogplayer.service /etc/systemd/system/"
echo "  sudo systemctl enable ogplayer"
echo "  sudo systemctl start ogplayer"

# Test the server
echo "🧪 Testing server configuration..."
if node -c simple-server.js; then
    echo "✅ Server configuration is valid"
else
    echo "❌ Server configuration has errors"
    exit 1
fi

# Start the server
echo "🎵 Starting the YouTube Music Server..."
echo "Server will be available at: http://your-server-ip:3001"
echo ""
echo "Available endpoints:"
echo "  🏠 Main interface: /"
echo "  🔍 Search: /api/search?q=query"
echo "  🎵 Stream: /api/stream/:videoId"
echo "  🍪 Cookie manager: /cookies.html"
echo "  ℹ️ Video info: /api/info/:videoId"
echo "  📊 Cookies status: /api/cookies-status"
echo ""
echo "🔧 Fixes applied:"
echo "  ✅ Enhanced CORS headers for media streaming"
echo "  ✅ Stream proxying to avoid ORB errors"
echo "  ✅ Cookie support for YouTube authentication"
echo "  ✅ Multiple format fallback strategies"
echo "  ✅ Better error handling and retry logic"
echo "  ✅ Updated yt-dlp with latest YouTube fixes"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
node simple-server.js
