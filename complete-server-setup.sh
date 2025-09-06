#!/bin/bash

# Complete server setup script with enhanced yt-dlp strategies
# Run this on your server after transferring the files

echo "🚀 Setting up Enhanced YouTube Music Server"
echo "==========================================="

# Update system packages
echo "📦 Updating system packages..."
sudo apt update 2>/dev/null || yum update -y 2>/dev/null || echo "Package manager not detected, skipping..."

# Update Python if possible (to fix the deprecation warning)
echo "🐍 Checking Python version..."
python3 --version
echo "Note: Python 3.9 is deprecated for yt-dlp. Consider upgrading to Python 3.10+ if possible."

# Update yt-dlp to latest version
echo "🔄 Updating yt-dlp to latest version..."
pip3 install -U yt-dlp || pip install -U yt-dlp || python3 -m pip install -U yt-dlp

# Check yt-dlp version
echo "✅ yt-dlp version:"
yt-dlp --version

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Verify cookies file exists
if [ ! -f "youtube_cookies.txt" ]; then
    echo "❌ ERROR: youtube_cookies.txt not found!"
    echo "Please upload the cookies file first."
    echo ""
    echo "You can:"
    echo "1. Use the web interface: http://$(hostname -I | awk '{print $1}'):3001/cookies.html"
    echo "2. Transfer via SCP: scp youtube_cookies.txt user@server:/path/to/ogplayer/"
    echo "3. Create manually with nano youtube_cookies.txt"
    exit 1
fi

echo "✅ Cookies file found: $(wc -c < youtube_cookies.txt) bytes"

# Test cookies with multiple strategies
echo "🧪 Testing cookies with enhanced strategies..."

# Test 1: Basic test
echo "Test 1: Basic functionality"
if yt-dlp --cookies youtube_cookies.txt --get-title "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > /dev/null 2>&1; then
    echo "✅ Basic test passed"
else
    echo "❌ Basic test failed"
fi

# Test 2: Android client
echo "Test 2: Android client extraction"
if yt-dlp --cookies youtube_cookies.txt --extractor-args "youtube:player_client=android" --get-title "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > /dev/null 2>&1; then
    echo "✅ Android client test passed"
else
    echo "❌ Android client test failed"
fi

# Test 3: The problematic video
echo "Test 3: Problematic video (-WVDfHUVym4)"
if yt-dlp --cookies youtube_cookies.txt --extractor-args "youtube:player_client=android" --get-title "https://www.youtube.com/watch?v=-WVDfHUVym4" > /dev/null 2>&1; then
    echo "✅ Problematic video test passed"
else
    echo "⚠️ Problematic video still failing (may be geo-blocked or restricted)"
fi

# Create enhanced test script
echo "📝 Creating enhanced test script..."
cat > test_video.sh << 'SCRIPT_EOF'
#!/bin/bash
VIDEO_ID="${1:-dQw4w9WgXcQ}"
VIDEO_URL="https://www.youtube.com/watch?v=$VIDEO_ID"

echo "🎵 Testing video: $VIDEO_URL"
echo "Strategies will be tried in order..."

strategies=(
    "--extractor-args youtube:player_client=android"
    "--extractor-args youtube:player_client=ios"
    "--extractor-args 'youtube:player_client=web,youtube:player_skip=webpage'"
    "--extractor-args youtube:player_client=tv"
    "--extractor-args 'youtube:player_client=android,ios,web' --retry-sleep linear=1:3:5"
    "--extractor-args youtube:player_client=android --age-limit 99"
)

for i, strategy in "${strategies[@]}"; do
    echo "Strategy $((i+1)): $strategy"
    if yt-dlp --cookies youtube_cookies.txt $strategy --get-url "$VIDEO_URL" > /dev/null 2>&1; then
        echo "✅ Success with strategy $((i+1))"
        exit 0
    fi
done

echo "❌ All strategies failed"
SCRIPT_EOF

chmod +x test_video.sh

# Set up process manager (optional)
echo "🔧 Setting up process management..."
if command -v systemctl &> /dev/null; then
    cat > ogplayer.service << EOF
[Unit]
Description=OG Music Player Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=$(which node) simple-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    echo "📄 Systemd service file created: ogplayer.service"
    echo "To install: sudo cp ogplayer.service /etc/systemd/system/ && sudo systemctl enable ogplayer"
fi

# Create startup script
cat > start_server.sh << 'EOF'
#!/bin/bash
echo "🎵 Starting OG Music Player Server..."

# Check if cookies exist
if [ ! -f "youtube_cookies.txt" ]; then
    echo "❌ No cookies file found. Please upload cookies first."
    echo "Visit: http://$(hostname -I | awk '{print $1}'):3001/cookies.html"
    exit 1
fi

# Kill any existing server
pkill -f "node simple-server.js" 2>/dev/null

# Start server in background
nohup node simple-server.js > server.log 2>&1 &
PID=$!

echo "✅ Server started with PID: $PID"
echo "📊 Server logs: tail -f server.log"
echo "🌐 Access at: http://$(hostname -I | awk '{print $1}'):3001"
echo "🍪 Cookie manager: http://$(hostname -I | awk '{print $1}'):3001/cookies.html"
echo "🛑 To stop: kill $PID"

# Wait a moment and check if server started successfully
sleep 3
if kill -0 $PID 2>/dev/null; then
    echo "🎉 Server is running successfully!"
else
    echo "❌ Server failed to start. Check server.log for errors."
    cat server.log
fi
EOF

chmod +x start_server.sh

# Create stop script
cat > stop_server.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping OG Music Player Server..."
pkill -f "node simple-server.js"
echo "✅ Server stopped"
EOF

chmod +x stop_server.sh

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Available commands:"
echo "  Start server: ./start_server.sh"
echo "  Stop server: ./stop_server.sh"
echo "  Test video: ./test_video.sh VIDEO_ID"
echo "  View logs: tail -f server.log"
echo ""
echo "🌐 Server will be available at:"
echo "  Main: http://$(hostname -I | awk '{print $1}'):3001"
echo "  Cookies: http://$(hostname -I | awk '{print $1}'):3001/cookies.html"
echo ""
echo "🔧 Enhanced features:"
echo "  ✅ Multiple extraction strategies"
echo "  ✅ Enhanced CORS support"
echo "  ✅ Cookie authentication"
echo "  ✅ Automatic retry logic"
echo "  ✅ Fallback mechanisms"
echo ""

# Ask if user wants to start the server now
read -p "Start the server now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./start_server.sh
else
    echo "Run './start_server.sh' when ready to start the server."
fi
