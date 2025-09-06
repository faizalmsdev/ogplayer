#!/bin/bash

# Script to transfer cookies and updated code to your server
# Run this script from your local machine

echo "🍪 Transferring YouTube cookies and updated code to server..."
echo "============================================================="

# Configuration - UPDATE THESE VALUES
SERVER_USER="prasanth"
SERVER_IP="209.74.95.163"  # Your server IP from the error message
SERVER_PATH="/home/prasanth/ogplayer"  # Adjust this path as needed
SSH_KEY=""  # Optional: path to SSH key file

# Files to transfer
FILES_TO_TRANSFER=(
    "simple-server.js"
    "youtube_cookies.txt"
    "public/simple.html"
    "public/cookies.html"
    "package.json"
    "CORS-FIX-GUIDE.md"
    "COOKIES-SETUP.md"
    "extract-cookies.js"
    "update-ytdlp.js"
    "deploy.sh"
)

# Check if cookies file exists
if [ ! -f "youtube_cookies.txt" ]; then
    echo "❌ Error: youtube_cookies.txt not found!"
    echo "Please run: node extract-cookies.js"
    echo "Or manually create the cookies file."
    exit 1
fi

echo "✅ Found cookies file: $(wc -c < youtube_cookies.txt) bytes"

# Transfer files
echo "📤 Transferring files to server..."

if [ -n "$SSH_KEY" ]; then
    SCP_CMD="scp -i $SSH_KEY"
else
    SCP_CMD="scp"
fi

for file in "${FILES_TO_TRANSFER[@]}"; do
    if [ -f "$file" ]; then
        echo "Transferring: $file"
        $SCP_CMD "$file" "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"
    else
        echo "⚠️ File not found: $file"
    fi
done

# Create remote setup script
echo "📝 Creating remote setup script..."
cat > setup_server.sh << 'EOF'
#!/bin/bash

echo "🔧 Setting up YouTube Music Server on remote server..."
echo "===================================================="

# Update yt-dlp
echo "🔄 Updating yt-dlp..."
pip3 install -U yt-dlp || pip install -U yt-dlp || python3 -m pip install -U yt-dlp

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Verify cookies file
if [ -f "youtube_cookies.txt" ]; then
    echo "✅ Cookies file found: $(wc -c < youtube_cookies.txt) bytes"
    
    # Test yt-dlp with cookies
    echo "🧪 Testing yt-dlp with cookies..."
    if yt-dlp --cookies youtube_cookies.txt --get-title "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > /dev/null 2>&1; then
        echo "✅ Cookies are working!"
    else
        echo "❌ Cookies test failed. You may need to refresh them."
    fi
else
    echo "❌ No cookies file found!"
    exit 1
fi

# Make scripts executable
chmod +x deploy.sh extract-cookies.js update-ytdlp.js

# Start the server
echo "🚀 Starting server..."
echo "Server will be available at: http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "To run in background: nohup node simple-server.js > server.log 2>&1 &"
echo "To stop: pkill -f simple-server.js"
echo ""

# Test the updated yt-dlp command from your error
echo "🧪 Testing the problematic command with cookies..."
echo "Command: yt-dlp --cookies youtube_cookies.txt -f bestaudio -o - https://www.youtube.com/watch?v=-WVDfHUVym4"
echo ""

node simple-server.js
EOF

# Transfer the setup script
$SCP_CMD setup_server.sh "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"

echo ""
echo "✅ Files transferred successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. SSH into your server:"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo ""
echo "2. Navigate to the project directory:"
echo "   cd $SERVER_PATH"
echo ""
echo "3. Run the setup script:"
echo "   chmod +x setup_server.sh"
echo "   ./setup_server.sh"
echo ""
echo "4. Test the cookies manually:"
echo "   yt-dlp --cookies youtube_cookies.txt --get-title 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'"
echo ""
echo "5. If cookies work, start the server:"
echo "   node simple-server.js"
echo ""
echo "🍪 The cookies should resolve the 'Sign in to confirm you're not a bot' error!"

# Cleanup
rm setup_server.sh
