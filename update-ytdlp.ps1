# PowerShell script to update yt-dlp
Write-Host "🔄 Updating yt-dlp to the latest version..." -ForegroundColor Yellow

# Check if yt-dlp is installed
try {
    $currentVersion = & yt-dlp --version 2>$null
    Write-Host "Current yt-dlp version: $currentVersion" -ForegroundColor Green
} catch {
    Write-Host "yt-dlp not found. Will attempt to install..." -ForegroundColor Red
}

# Try different update methods
$updateMethods = @(
    @{Command = "yt-dlp"; Args = @("-U"); Description = "Self-update"}
    @{Command = "pip"; Args = @("install", "-U", "yt-dlp"); Description = "pip update"}
    @{Command = "pip3"; Args = @("install", "-U", "yt-dlp"); Description = "pip3 update"}
    @{Command = "python"; Args = @("-m", "pip", "install", "-U", "yt-dlp"); Description = "Python pip update"}
    @{Command = "python3"; Args = @("-m", "pip", "install", "-U", "yt-dlp"); Description = "Python3 pip update"}
)

$updated = $false

foreach ($method in $updateMethods) {
    Write-Host "Trying: $($method.Description) - $($method.Command) $($method.Args -join ' ')" -ForegroundColor Cyan
    
    try {
        $process = Start-Process -FilePath $method.Command -ArgumentList $method.Args -Wait -PassThru -NoNewWindow -RedirectStandardOutput "update_output.txt" -RedirectStandardError "update_error.txt"
        
        if ($process.ExitCode -eq 0) {
            Write-Host "✅ yt-dlp updated successfully using $($method.Description)!" -ForegroundColor Green
            
            if (Test-Path "update_output.txt") {
                $output = Get-Content "update_output.txt" -Raw
                Write-Host $output
                Remove-Item "update_output.txt" -ErrorAction SilentlyContinue
            }
            
            $updated = $true
            break
        } else {
            if (Test-Path "update_error.txt") {
                $errorOutput = Get-Content "update_error.txt" -Raw
                Write-Host "❌ Failed: $errorOutput" -ForegroundColor Red
                Remove-Item "update_error.txt" -ErrorAction SilentlyContinue
            }
        }
    } catch {
        Write-Host "❌ Command not found: $($method.Command)" -ForegroundColor Red
    }
}

# Clean up temp files
Remove-Item "update_output.txt" -ErrorAction SilentlyContinue
Remove-Item "update_error.txt" -ErrorAction SilentlyContinue

if (-not $updated) {
    Write-Host "❌ All update methods failed. Please manually update yt-dlp:" -ForegroundColor Red
    Write-Host "1. pip install -U yt-dlp" -ForegroundColor Yellow
    Write-Host "2. Or download from: https://github.com/yt-dlp/yt-dlp/releases" -ForegroundColor Yellow
    Write-Host "3. Make sure Python and pip are installed and in your PATH" -ForegroundColor Yellow
} else {
    # Verify new version
    try {
        $newVersion = & yt-dlp --version 2>$null
        Write-Host "New yt-dlp version: $newVersion" -ForegroundColor Green
        Write-Host "🎉 Update completed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Update may have succeeded but cannot verify version" -ForegroundColor Yellow
    }
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
