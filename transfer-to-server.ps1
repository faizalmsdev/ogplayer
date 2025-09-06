# PowerShell script to transfer cookies and updated code to your server
# Run this script from your local machine

Write-Host "🍪 Transferring YouTube cookies and updated code to server..." -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Yellow

# Configuration - UPDATE THESE VALUES
$SERVER_USER = "prasanth"
$SERVER_IP = "209.74.95.163"  # Your server IP from the error message
$SERVER_PATH = "/home/prasanth/ogplayer"  # Adjust this path as needed

# Files to transfer
$FILES_TO_TRANSFER = @(
    "simple-server.js",
    "youtube_cookies.txt",
    "public/simple.html",
    "public/cookies.html",
    "package.json",
    "CORS-FIX-GUIDE.md",
    "COOKIES-SETUP.md",
    "extract-cookies.js",
    "update-ytdlp.js",
    "deploy.sh"
)

# Check if cookies file exists
if (-not (Test-Path "youtube_cookies.txt")) {
    Write-Host "❌ Error: youtube_cookies.txt not found!" -ForegroundColor Red
    Write-Host "Please run: node extract-cookies.js" -ForegroundColor Yellow
    Write-Host "Or manually create the cookies file." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

$cookieSize = (Get-Item "youtube_cookies.txt").Length
Write-Host "✅ Found cookies file: $cookieSize bytes" -ForegroundColor Green

# Check if SCP is available (Windows 10/11 with OpenSSH)
$scpAvailable = Get-Command scp -ErrorAction SilentlyContinue
if (-not $scpAvailable) {
    Write-Host "❌ SCP not found. Please install OpenSSH Client feature or use WinSCP/FileZilla." -ForegroundColor Red
    Write-Host "Alternative: Use WSL or install Git Bash for SCP support." -ForegroundColor Yellow
    
    Write-Host "`n📋 Manual transfer instructions:" -ForegroundColor Cyan
    Write-Host "1. Use WinSCP, FileZilla, or similar tool" -ForegroundColor White
    Write-Host "2. Connect to: $SERVER_USER@$SERVER_IP" -ForegroundColor White
    Write-Host "3. Navigate to: $SERVER_PATH" -ForegroundColor White
    Write-Host "4. Upload these files:" -ForegroundColor White
    foreach ($file in $FILES_TO_TRANSFER) {
        if (Test-Path $file) {
            Write-Host "   - $file" -ForegroundColor Gray
        }
    }
    
    Read-Host "Press Enter to continue with manual instructions"
} else {
    # Transfer files using SCP
    Write-Host "📤 Transferring files to server..." -ForegroundColor Cyan

    foreach ($file in $FILES_TO_TRANSFER) {
        if (Test-Path $file) {
            Write-Host "Transferring: $file" -ForegroundColor Gray
            try {
                & scp $file "$SERVER_USER@${SERVER_IP}:$SERVER_PATH/"
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ $file transferred successfully" -ForegroundColor Green
                } else {
                    Write-Host "❌ Failed to transfer $file" -ForegroundColor Red
                }
            } catch {
                Write-Host "❌ Error transferring $file : $_" -ForegroundColor Red
            }
        } else {
            Write-Host "⚠️ File not found: $file" -ForegroundColor Yellow
        }
    }
}

# Create remote setup script content
$setupScript = @'
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
        echo "Try running: yt-dlp --cookies youtube_cookies.txt --get-title 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'"
    fi
else
    echo "❌ No cookies file found!"
    exit 1
fi

# Make scripts executable
chmod +x deploy.sh 2>/dev/null
chmod +x extract-cookies.js 2>/dev/null
chmod +x update-ytdlp.js 2>/dev/null

echo ""
echo "🧪 Testing the problematic command with cookies..."
echo "Original failing command: yt-dlp -f bestaudio -o - https://www.youtube.com/watch?v=-WVDfHUVym4"
echo "Fixed command: yt-dlp --cookies youtube_cookies.txt -f bestaudio -o - https://www.youtube.com/watch?v=-WVDfHUVym4"
echo ""
echo "🚀 Starting server..."
echo "Server will be available at: http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "To run in background: nohup node simple-server.js > server.log 2>&1 &"
echo "To stop: pkill -f simple-server.js"
echo ""

node simple-server.js
'@

# Save setup script
$setupScript | Out-File -FilePath "setup_server.sh" -Encoding UTF8

if ($scpAvailable) {
    Write-Host "📝 Transferring setup script..." -ForegroundColor Cyan
    try {
        & scp "setup_server.sh" "$SERVER_USER@${SERVER_IP}:$SERVER_PATH/"
        Write-Host "✅ Setup script transferred" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to transfer setup script" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Transfer preparation completed!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Cyan
Write-Host "1. SSH into your server:" -ForegroundColor White
Write-Host "   ssh $SERVER_USER@$SERVER_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Navigate to the project directory:" -ForegroundColor White
Write-Host "   cd $SERVER_PATH" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Run the setup script:" -ForegroundColor White
Write-Host "   chmod +x setup_server.sh" -ForegroundColor Gray
Write-Host "   ./setup_server.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test the cookies manually:" -ForegroundColor White
Write-Host "   yt-dlp --cookies youtube_cookies.txt --get-title 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test the original failing command:" -ForegroundColor White
Write-Host "   yt-dlp --cookies youtube_cookies.txt -f bestaudio -o - https://www.youtube.com/watch?v=-WVDfHUVym4" -ForegroundColor Gray
Write-Host ""
Write-Host "🍪 The cookies should resolve the 'Sign in to confirm you're not a bot' error!" -ForegroundColor Yellow

# Cleanup
Remove-Item "setup_server.sh" -ErrorAction SilentlyContinue

Write-Host ""
Read-Host "Press Enter to exit"
