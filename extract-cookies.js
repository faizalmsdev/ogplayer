#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🍪 YouTube Cookies Extractor for Server Use');
console.log('==========================================');

const cookiesFile = path.join(__dirname, 'youtube_cookies.txt');

// Method 1: Extract cookies using yt-dlp directly
function extractCookiesWithYtDlp() {
  console.log('\n📥 Method 1: Extracting cookies using yt-dlp...');
  
  const browsers = ['chrome', 'firefox', 'safari', 'edge', 'opera'];
  
  for (const browser of browsers) {
    try {
      console.log(`Trying to extract from ${browser}...`);
      
      // Use yt-dlp to extract cookies from browser
      execSync(
        `yt-dlp --cookies-from-browser ${browser} --cookies ${cookiesFile} --no-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`,
        { stdio: 'pipe' }
      );
      
      if (fs.existsSync(cookiesFile)) {
        console.log(`✅ Successfully extracted cookies from ${browser}!`);
        console.log(`📁 Cookies saved to: ${cookiesFile}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ Failed to extract from ${browser}: ${error.message}`);
    }
  }
  
  return false;
}

// Method 2: Create manual instructions
function showManualInstructions() {
  console.log('\n📝 Method 2: Manual Cookie Extraction');
  console.log('====================================');
  console.log('');
  console.log('If automatic extraction failed, follow these steps:');
  console.log('');
  console.log('1. Install browser extension:');
  console.log('   - Chrome: "Get cookies.txt LOCALLY" or "cookies.txt"');
  console.log('   - Firefox: "cookies.txt" add-on');
  console.log('');
  console.log('2. Go to YouTube (youtube.com) and log in');
  console.log('');
  console.log('3. Use the extension to export cookies');
  console.log('');
  console.log('4. Save the exported cookies as "youtube_cookies.txt" in this folder:');
  console.log(`   ${__dirname}`);
  console.log('');
  console.log('5. Or upload via API endpoint:');
  console.log('   POST /api/upload-cookies');
  console.log('');
  console.log('Alternative method using browser developer tools:');
  console.log('1. Open YouTube, press F12');
  console.log('2. Go to Application/Storage tab');
  console.log('3. Copy cookies manually');
  console.log('');
}

// Method 3: Generate sample cookies file template
function generateTemplate() {
  const template = `# Netscape HTTP Cookie File
# This is a generated file!  Do not edit.

# Replace these with actual YouTube cookies
# Format: domain	flag	path	secure	expiration	name	value
.youtube.com	TRUE	/	TRUE	1999999999	session_token	YOUR_SESSION_TOKEN_HERE
.youtube.com	TRUE	/	FALSE	1999999999	VISITOR_INFO1_LIVE	YOUR_VISITOR_INFO_HERE
.youtube.com	TRUE	/	TRUE	1999999999	LOGIN_INFO	YOUR_LOGIN_INFO_HERE
.youtube.com	TRUE	/	FALSE	1999999999	PREF	YOUR_PREF_HERE
.youtube.com	TRUE	/	TRUE	1999999999	SID	YOUR_SID_HERE
.youtube.com	TRUE	/	TRUE	1999999999	HSID	YOUR_HSID_HERE
.youtube.com	TRUE	/	TRUE	1999999999	SSID	YOUR_SSID_HERE
.youtube.com	TRUE	/	TRUE	1999999999	APISID	YOUR_APISID_HERE
.youtube.com	TRUE	/	TRUE	1999999999	SAPISID	YOUR_SAPISID_HERE

# Instructions:
# 1. Replace all YOUR_*_HERE values with actual cookie values from your browser
# 2. Get cookie values from browser developer tools (F12 -> Application -> Cookies)
# 3. Or use a cookie extraction browser extension
`;

  const templateFile = path.join(__dirname, 'youtube_cookies_template.txt');
  fs.writeFileSync(templateFile, template);
  console.log(`📄 Template created: ${templateFile}`);
}

// Main execution
async function main() {
  try {
    // Try automatic extraction first
    const extracted = extractCookiesWithYtDlp();
    
    if (!extracted) {
      console.log('\n⚠️ Automatic extraction failed.');
      showManualInstructions();
      generateTemplate();
    }
    
    // Check if cookies file exists and show status
    if (fs.existsSync(cookiesFile)) {
      const stats = fs.statSync(cookiesFile);
      console.log('\n📊 Cookies Status:');
      console.log(`✅ File exists: ${cookiesFile}`);
      console.log(`📏 Size: ${stats.size} bytes`);
      console.log(`🕒 Last modified: ${stats.mtime}`);
      console.log('');
      console.log('🚀 You can now use this on your server!');
      console.log('📤 Upload this file to your server or use the API endpoint.');
    } else {
      console.log('\n❌ No cookies file found. Please follow manual instructions above.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    showManualInstructions();
  }
}

main();
