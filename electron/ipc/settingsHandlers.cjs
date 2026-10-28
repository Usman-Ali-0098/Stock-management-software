'use strict';

const { ipcMain } = require('electron');
const fs = require('fs');
const { getDb, getDbPath } = require('../database/init.cjs');

const ALLOWED_KEYS = new Set([
  'shop_name', 'shop_address', 'shop_contact', 'date_format',
]);

/**
 * Performs a factory reset by safely removing test transactions, rolls, and products.
 * Automatically saves a safety backup before wiping data.
 */
function performFactoryReset(options = {}) {
  const db = getDb();
  let safetyBackupPath = null;

  try {
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      safetyBackupPath = dbPath + `.safety-factory-reset-${timestamp}.bak`;
      db.exec(`VACUUM INTO '${safetyBackupPath.replace(/'/g, "''")}'`);
    }
  } catch (backupErr) {
    console.warn('Warning: Could not create safety backup before factory reset:', backupErr.message);
  }

  const resetTx = db.transaction(() => {
    // Delete in reverse foreign-key dependency order
    db.exec(`
      DELETE FROM stock_movements;
      DELETE FROM bulk_stock_movements;
      DELETE FROM outward_lines;
      DELETE FROM outward_bulk_lines;
      DELETE FROM outward_transaction_items;
      DELETE FROM outward_transactions;
      DELETE FROM inward_lines;
      DELETE FROM inward_bulk_lines;
      DELETE FROM inward_transaction_items;
      DELETE FROM rolls;
      DELETE FROM inward_transactions;
      DELETE FROM variants;
      DELETE FROM bulk_lots;
      DELETE FROM roll_history;
    `);

    // Clear test products if requested (default: true)
    if (options.clearProducts !== false) {
      db.exec(`DELETE FROM products;`);
    }

    // Reset sqlite sequence counters
    db.exec(`
      DELETE FROM sqlite_sequence WHERE name IN (
        'rolls', 'inward_transactions', 'inward_transaction_items',
        'outward_transactions', 'outward_transaction_items',
        'roll_history', 'products', 'variants', 'stock_movements',
        'inward_lines', 'outward_lines', 'bulk_lots', 'bulk_stock_movements',
        'inward_bulk_lines', 'outward_bulk_lines'
      );
    `);

    // Reset godowns to default if requested
    if (options.resetGodowns) {
      db.exec(`
        DELETE FROM godowns WHERE id > 2;
        UPDATE godowns SET name = 'Godown 1 — Main Warehouse', address = 'Shah Alam Market, Lahore', is_active = 1 WHERE id = 1;
        UPDATE godowns SET name = 'Godown 2 — Shah Alam Store', address = 'Circular Road, Lahore', is_active = 1 WHERE id = 2;
        INSERT OR IGNORE INTO godowns (id, name, address) VALUES
          (1, 'Godown 1 — Main Warehouse', 'Shah Alam Market, Lahore'),
          (2, 'Godown 2 — Shah Alam Store', 'Circular Road, Lahore');
      `);
    }

    // Reset settings if requested
    if (options.resetSettings) {
      db.exec(`
        DELETE FROM application_settings;
        INSERT INTO application_settings (key, value) VALUES
          ('shop_name', 'Haji Rafiq Phoga Leather Shop'),
          ('shop_address', 'Shah Alam Market, Lahore, Pakistan'),
          ('shop_contact', ''),
          ('print_mode', 'a4'),
          ('date_format', 'DD/MM/YYYY');
      `);
    }
  });

  resetTx();

  try {
    db.exec('VACUUM;');
  } catch {
    // Best-effort in WAL mode
  }

  return {
    success: true,
    data: {
      message: 'Factory reset complete. All test data has been deleted.',
      safetyBackupPath
    }
  };
}

if (ipcMain && ipcMain.handle) {
  ipcMain.handle('settings:get', async () => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT key, value FROM application_settings').all();
      const settings = {};
      rows.forEach(r => { settings[r.key] = r.value; });
      return { success: true, data: settings };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:set', async (_event, updates) => {
    try {
      const db = getDb();
      const upsert = db.prepare(`
        INSERT INTO application_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now', 'localtime'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);

      const doUpdate = db.transaction((kv) => {
        for (const [key, value] of Object.entries(kv)) {
          if (!ALLOWED_KEYS.has(key)) {
            throw new Error(`Unknown settings key: ${key}`);
          }
          upsert.run(key, String(value));
        }
      });

      doUpdate(updates);

      const rows = db.prepare('SELECT key, value FROM application_settings').all();
      const settings = {};
      rows.forEach(r => { settings[r.key] = r.value; });
      return { success: true, data: settings };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:factoryReset', async (_event, options) => {
    try {
      return performFactoryReset(options || {});
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { performFactoryReset };
