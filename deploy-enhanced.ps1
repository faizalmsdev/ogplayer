# PowerShell script to transfer the complete enhanced solution to your server

Write-Host "🚀 Transferring Enhanced YouTube Music Server Solution" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green

$SERVER_USER = "prasanth"
$SERVER_IP = "209.74.95.163"
$SERVER_PATH = "/home/prasanth/ogplayer"

# Files to transfer
$ENHANCED_FILES = @(
    "simple-server.js",
    "youtube_cookies.txt", 
    "complete-server-setup.sh",
    "test-enhanced-ytdlp.sh",
    "FINAL-SOLUTION.md",
    "public/simple.html",
    "public/cookies.html",
    "package.json"
)

Write-Host "📋 Files to transfer:" -ForegroundColor Cyan
foreach ($file in $ENHANCED_FILES) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

Write-Host ""
$continue = Read-Host "Continue with transfer? (y/N)"
if ($continue -notmatch '^[Yy]$') {
    Write-Host "Transfer cancelled." -ForegroundColor Yellow
    exit
}

# Check if SCP is available
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "❌ SCP not available. Please use WinSCP, FileZilla, or enable OpenSSH." -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Manual transfer instructions:" -ForegroundColor Cyan
    Write-Host "1. Use WinSCP or FileZilla" -ForegroundColor White
    Write-Host "2. Connect to: $SERVER_USER@$SERVER_IP" -ForegroundColor White
    Write-Host "3. Navigate to: $SERVER_PATH" -ForegroundColor White
    Write-Host "4. Upload the files listed above" -ForegroundColor White
    Write-Host "5. Then run: chmod +x complete-server-setup.sh && ./complete-server-setup.sh" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit
}

# Transfer files
Write-Host "📤 Transferring files..." -ForegroundColor Cyan
$successCount = 0
$failCount = 0

foreach ($file in $ENHANCED_FILES) {
    if (Test-Path $file) {
        Write-Host "Transferring: $file" -ForegroundColor Gray
        try {
            & scp $file "$SERVER_USER@${SERVER_IP}:$SERVER_PATH/"
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ Success" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "  ❌ Failed" -ForegroundColor Red
                $failCount++
            }
        } catch {
            Write-Host "  ❌ Error: $_" -ForegroundColor Red
            $failCount++
        }
    } else {
        Write-Host "⚠️ Skipping missing file: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 Transfer Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Successful: $successCount" -ForegroundColor Green
Write-Host "  ❌ Failed: $failCount" -ForegroundColor Red

if ($successCount -gt 0) {
    Write-Host ""
    Write-Host "🎯 Next Steps on Your Server:" -ForegroundColor Yellow
    Write-Host "=============================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. SSH to your server:" -ForegroundColor White
    Write-Host "   ssh $SERVER_USER@$SERVER_IP" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Navigate to project directory:" -ForegroundColor White  
    Write-Host "   cd $SERVER_PATH" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Run the enhanced setup:" -ForegroundColor White
    Write-Host "   chmod +x complete-server-setup.sh" -ForegroundColor Gray
    Write-Host "   ./complete-server-setup.sh" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Test the problematic video:" -ForegroundColor White
    Write-Host "   chmod +x test-enhanced-ytdlp.sh" -ForegroundColor Gray
    Write-Host "   ./test-enhanced-ytdlp.sh" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. Start the enhanced server:" -ForegroundColor White
    Write-Host "   ./start_server.sh" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🌐 Your server will be available at:" -ForegroundColor Cyan
    Write-Host "   http://209.74.95.163:3001" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Enhanced Features:" -ForegroundColor Green
    Write-Host "  ✅ 6 different extraction strategies" -ForegroundColor Gray
    Write-Host "  ✅ Android/iOS/Web/TV client support" -ForegroundColor Gray
    Write-Host "  ✅ Age-gate and geo-block bypass attempts" -ForegroundColor Gray
    Write-Host "  ✅ Enhanced CORS and streaming support" -ForegroundColor Gray
    Write-Host "  ✅ Automatic retry with exponential backoff" -ForegroundColor Gray
    Write-Host "  ✅ Cookie-based authentication" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🎉 This should fix the 'Sign in to confirm you're not a bot' error!" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
