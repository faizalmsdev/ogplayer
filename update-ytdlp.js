#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🔄 Updating yt-dlp to the latest version...');

// Try different update methods
const updateMethods = [
  ['yt-dlp', ['-U']],
  ['pip', ['install', '-U', 'yt-dlp']],
  ['pip3', ['install', '-U', 'yt-dlp']],
  ['python', ['-m', 'pip', 'install', '-U', 'yt-dlp']],
  ['python3', ['-m', 'pip', 'install', '-U', 'yt-dlp']]
];

async function tryUpdate(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${command} failed: ${error}`));
      }
    });
  });
}

async function updateYtDlp() {
  for (const [command, args] of updateMethods) {
    try {
      console.log(`Trying: ${command} ${args.join(' ')}`);
      const result = await tryUpdate(command, args);
      console.log('✅ yt-dlp updated successfully!');
      console.log(result);
      return true;
    } catch (error) {
      console.log(`❌ Failed with ${command}: ${error.message}`);
      continue;
    }
  }
  
  console.log('❌ All update methods failed. Please manually update yt-dlp:');
  console.log('1. pip install -U yt-dlp');
  console.log('2. Or download from: https://github.com/yt-dlp/yt-dlp/releases');
  return false;
}

// Check current version first
const versionProcess = spawn('yt-dlp', ['--version']);
versionProcess.stdout.on('data', (data) => {
  console.log(`Current version: ${data.toString().trim()}`);
});

versionProcess.on('close', (code) => {
  if (code === 0) {
    updateYtDlp();
  } else {
    console.log('yt-dlp not found, attempting to install...');
    updateYtDlp();
  }
});
