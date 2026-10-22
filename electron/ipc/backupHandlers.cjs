'use strict';

const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { closeDatabase, initDatabase, getDb } = require('../database/init.cjs');

function getDbPath() {
  return path.join(app.getPath('userData'), 'warehouse.db');
}

/**
 * Create a backup of the current database.
 * Uses SQLite's VACUUM INTO for a clean, self-contained backup file.
 */
ipcMain.handle('backup:create', async (event) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Database Backup',
      defaultPath: `warehouse-backup-${new Date().toISOString().slice(0,10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Backup cancelled.' };
    }

    const db = getDb();
    // VACUUM INTO creates a clean, defragmented copy
    db.exec(`VACUUM INTO '${filePath.replace(/'/g, "''")}'`);

    // Verify the backup file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('Backup file is empty after VACUUM INTO.');
    }

    return { success: true, data: { filePath, sizeBytes: stats.size } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Restore from a backup file.
 * Steps:
 * 1. Validate the backup is a valid SQLite database.
 * 2. Create a safety backup of the current data.
 * 3. Close current database.
 * 4. Replace the database file.
 * 5. Reopen and verify.
 */
ipcMain.handle('backup:restore', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Backup File to Restore',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: 'Restore cancelled.' };
    }

    const backupPath = filePaths[0];

    // 1. Validate: must be a SQLite file (magic header check)
    const fd = fs.openSync(backupPath, 'r');
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    const magic = header.toString('utf8', 0, 16);
    if (!magic.startsWith('SQLite format 3')) {
      return { success: false, error: 'The selected file is not a valid SQLite database.' };
    }

    // 2. Validate backup structure: try to open and query schema_migrations
    const Database = require('better-sqlite3');
    let testDb;
    try {
      testDb = new Database(backupPath, { readonly: true });
      testDb.pragma('integrity_check');
      const hasMigrations = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='products'"
      ).get();
      if (!hasMigrations) {
        return { success: false, error: 'The backup does not contain a valid warehouse database schema.' };
      }
    } finally {
      if (testDb) testDb.close();
    }

    // 3. Create a safety backup of current data before replacing
    const currentDbPath = getDbPath();
    const safetyBackupPath = currentDbPath + `.safety-${Date.now()}.bak`;
    if (fs.existsSync(currentDbPath)) {
      const currentDb = getDb();
      currentDb.exec(`VACUUM INTO '${safetyBackupPath.replace(/'/g, "''")}'`);
    }

    // 4. Close current database
    closeDatabase();

    // 5. Replace database file
    fs.copyFileSync(backupPath, currentDbPath);

    // 6. Reopen and verify
    initDatabase(currentDbPath);
    const freshDb = getDb();
    const check = freshDb.pragma('integrity_check', { simple: true });
    if (check !== 'ok') {
      // Rollback: restore safety backup
      closeDatabase();
      fs.copyFileSync(safetyBackupPath, currentDbPath);
      initDatabase(currentDbPath);
      return { success: false, error: 'Restored database failed integrity check. Original data has been preserved.' };
    }

    return { success: true, data: { message: 'Database restored successfully. Please restart the application.', safetyBackupPath } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
