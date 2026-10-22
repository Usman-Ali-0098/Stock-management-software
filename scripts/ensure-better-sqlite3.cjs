'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET_DIR = path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release');
const TARGET_FILE = path.join(TARGET_DIR, 'better_sqlite3.node');

const PREBUILD_URL = 'https://github.com/WiseLibs/better-sqlite3/releases/download/v11.8.1/better-sqlite3-v11.8.1-electron-v130-win32-x64.tar.gz';

async function main() {
  if (!fs.existsSync(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'))) {
    console.log('[ensure-better-sqlite3] better-sqlite3 not installed yet, skipping.');
    return;
  }

  // If file already exists and is ~1.7MB (the official electron v130 binary), we can skip
  if (fs.existsSync(TARGET_FILE)) {
    const stats = fs.statSync(TARGET_FILE);
    if (stats.size > 1500000 && stats.size < 2000000) {
      console.log('[ensure-better-sqlite3] Compatible Electron 33 prebuilt binary is already in place.');
      return;
    }
  }

  console.log('[ensure-better-sqlite3] Fetching Electron 33 prebuilt binary for better-sqlite3...');
  const res = await fetch(PREBUILD_URL, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to download prebuild: ${res.status} ${res.statusText}`);
  }

  const tempTar = path.join(__dirname, 'temp_prebuild.tar.gz');
  const tempExtract = path.join(__dirname, 'temp_extract');

  try {
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tempTar, buffer);

    if (fs.existsSync(tempExtract)) {
      fs.rmSync(tempExtract, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExtract, { recursive: true });

    // Extract using Windows built-in tar
    execSync(`tar -xzf "${tempTar}" -C "${tempExtract}"`, { stdio: 'inherit' });

    fs.mkdirSync(TARGET_DIR, { recursive: true });
    fs.copyFileSync(path.join(tempExtract, 'build', 'Release', 'better_sqlite3.node'), TARGET_FILE);

    console.log('[ensure-better-sqlite3] Successfully installed Electron 33 binary to:', TARGET_FILE);
  } finally {
    if (fs.existsSync(tempTar)) fs.rmSync(tempTar, { force: true });
    if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[ensure-better-sqlite3] Error:', err);
  process.exit(1);
});
