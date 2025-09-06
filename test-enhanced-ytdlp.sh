#!/bin/bash

# Enhanced yt-dlp command for stubborn videos
# This script tries multiple extraction strategies

VIDEO_URL="$1"
if [ -z "$VIDEO_URL" ]; then
    VIDEO_URL="https://www.youtube.com/watch?v=-WVDfHUVym4"
fi

echo "🎵 Testing enhanced yt-dlp strategies for: $VIDEO_URL"
echo "============================================================"

# Strategy 1: Standard with cookies
echo "📋 Strategy 1: Standard extraction with cookies"
yt-dlp --cookies youtube_cookies.txt -f bestaudio --get-url "$VIDEO_URL"
if [ $? -eq 0 ]; then
    echo "✅ Strategy 1 worked!"
    exit 0
fi

echo ""
echo "📋 Strategy 2: Android client extraction"
yt-dlp --cookies youtube_cookies.txt \
    --extractor-args "youtube:player_client=android" \
    -f bestaudio --get-url "$VIDEO_URL"
if [ $? -eq 0 ]; then
    echo "✅ Strategy 2 worked!"
    exit 0
fi

echo ""
echo "📋 Strategy 3: iOS client extraction"
yt-dlp --cookies youtube_cookies.txt \
    --extractor-args "youtube:player_client=ios" \
    -f bestaudio --get-url "$VIDEO_URL"
if [ $? -eq 0 ]; then
    echo "✅ Strategy 3 worked!"
    exit 0
fi

echo ""
echo "📋 Strategy 4: Web client with skip"
yt-dlp --cookies youtube_cookies.txt \
    --extractor-args "youtube:player_client=web,youtube:player_skip=webpage" \
    -f bestaudio --get-url "$VIDEO_URL"
if [ $? -eq 0 ]; then
    echo "✅ Strategy 4 worked!"
    exit 0
fi

echo ""
echo "📋 Strategy 5: TV client extraction"
yt-dlp --cookies youtube_cookies.txt \
    --extractor-args "youtube:player_client=tv" \
    -f bestaudio --get-url "$VIDEO_URL"
if [ $? -eq 0 ]; then
    echo "✅ Strategy 5 worked!"
    exit 0
fi

echo ""
echo "📋 Strategy 6: Multiple clients with retry"
yt-dlp --cookies youtube_cookies.txt \
    --extractor-args "youtube:player_client=android,ios,web" \
    --retry-sleep linear=1:5:10 \
    --extractor-retries 3 \
    -f bestaudio --get-url "$VIDEO_URL"
if [ $? -eq 0 ]; then
    echo "✅ Strategy 6 worked!"
    exit 0
fi

echo ""
echo "📋 Strategy 7: Age-gate bypass"
yt-dlp --cookies youtube_cookies.txt \
    --extractor-args "youtube:player_client=android" \
    --extractor-args "youtube:skip=hls,dash" \
    --age-limit 99 \
    -f bestaudio --get-url "$VIDEO_URL"
if [ $? -eq 0 ]; then
    echo "✅ Strategy 7 worked!"
    exit 0
fi

echo ""
echo "❌ All strategies failed for this video."
echo "This video might be:"
echo "  - Geo-blocked in your region"
echo "  - Age-restricted and requires login"
echo "  - Temporarily unavailable"
echo "  - Protected by additional bot detection"
echo ""
echo "💡 Suggestions:"
echo "  1. Try a different video to test"
echo "  2. Update cookies (they might be expired)"
echo "  3. Use a VPN if geo-blocked"
echo "  4. Check if the video is available in your browser"
