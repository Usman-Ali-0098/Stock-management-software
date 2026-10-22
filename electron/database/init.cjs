'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const electron = require('electron');
const app = electron && electron.app;
const fs = require('fs');

let db = null;

/**
 * Returns the path to the database file.
 * Stored in Electron's userData directory (e.g. AppData/Roaming/leather-warehouse-wms/)
 * NEVER inside the installation folder to survive updates.
 */
function getDbPath() {
  const userDataPath = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : path.join(process.cwd(), 'data');
  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return path.join(userDataPath, 'warehouse.db');
}

/**
 * Returns the singleton database connection.
 * Throws if the database has not been initialized.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Initializes the SQLite database, applies all migrations, and enables WAL mode.
 */
function initDatabase(dbPath) {
  const resolvedPath = dbPath || getDbPath();
  db = new Database(resolvedPath);

  // Enable WAL for better concurrent read performance
  db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');
  // Optimize for reliability
  db.pragma('synchronous = NORMAL');

  runMigrations(db);
  return db;
}

/**
 * Closes and resets the database connection.
 * Used during backup/restore operations.
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Runs all schema migrations in order.
 * Tracks applied migrations in the schema_migrations table.
 */
function runMigrations(database) {
  // Create migrations tracking table first
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  const migrations = [
    { version: 1, description: 'Initial schema with godowns & rolls', sql: migration_001 },
    { version: 2, description: 'Application settings', sql: migration_002 },
    { version: 3, description: 'Multi-godown upgrade and roll history', run: migration_003_fn },
    { version: 4, description: 'Supplier bills and pending roll verification', sql: migration_004 },
    { version: 5, description: 'Incoming stock pricing (rate_per_meter and total_price)', run: migration_005_fn },
    { version: 6, description: 'Update shop name to Haji Rafiq Phoga Leather Shop', sql: migration_006 },
  ];

  for (const migration of migrations) {
    const existing = database.prepare(
      'SELECT version FROM schema_migrations WHERE version = ?'
    ).get(migration.version);

    if (!existing) {
      if (migration.sql) {
        const applySql = database.transaction(() => {
          database.exec(migration.sql);
          database.prepare(
            `INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (?, ?)`
          ).run(migration.version, migration.description);
        });
        applySql();
      } else if (typeof migration.run === 'function') {
        const applyFn = database.transaction(() => {
          migration.run(database);
          database.prepare(
            `INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (?, ?)`
          ).run(migration.version, migration.description);
        });
        applyFn();
      }
      console.log(`Applied migration ${migration.version}: ${migration.description}`);
    }
  }
}

// ─── Migration 001: Core schema ─────────────────────────────────────────────

const migration_001 = `
  -- ─── Godowns ───────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS godowns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    address     TEXT    NOT NULL DEFAULT '',
    is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_godowns_name ON godowns (name);

  -- Seed default godowns
  INSERT OR IGNORE INTO godowns (id, name, address) VALUES
    (1, 'Godown 1 — Main Warehouse', 'Shah Alam Market, Lahore'),
    (2, 'Godown 2 — Shah Alam Store', 'Circular Road, Lahore');

  -- ─── Products ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    product_name   TEXT    NOT NULL,
    description    TEXT    NOT NULL DEFAULT '',
    is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_code ON products (product_code);

  -- ─── Inward transactions ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS inward_transactions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    godown_id        INTEGER NOT NULL DEFAULT 1 REFERENCES godowns(id),
    slip_number      TEXT    NOT NULL UNIQUE,
    transaction_date TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    reference_note   TEXT    NOT NULL DEFAULT '',
    notes            TEXT    NOT NULL DEFAULT '',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_inward_godown ON inward_transactions (godown_id);
  CREATE INDEX IF NOT EXISTS idx_inward_slip   ON inward_transactions (slip_number);
  CREATE INDEX IF NOT EXISTS idx_inward_date   ON inward_transactions (transaction_date);

  -- ─── Physical rolls ────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS rolls (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_code                TEXT    NOT NULL UNIQUE,
    product_id               INTEGER NOT NULL REFERENCES products(id),
    godown_id                INTEGER NOT NULL DEFAULT 1 REFERENCES godowns(id),
    original_length_mm       INTEGER NOT NULL CHECK (original_length_mm > 0),
    remaining_length_mm      INTEGER NOT NULL CHECK (remaining_length_mm >= 0),
    status                   TEXT    NOT NULL DEFAULT 'available'
                                     CHECK (status IN ('available', 'fully_issued')),
    inward_transaction_id    INTEGER NOT NULL REFERENCES inward_transactions(id),
    received_at              TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    notes                    TEXT    NOT NULL DEFAULT '',
    CHECK (remaining_length_mm <= original_length_mm)
  );

  CREATE INDEX IF NOT EXISTS idx_rolls_product ON rolls (product_id);
  CREATE INDEX IF NOT EXISTS idx_rolls_godown  ON rolls (godown_id);
  CREATE INDEX IF NOT EXISTS idx_rolls_status  ON rolls (status);
  CREATE INDEX IF NOT EXISTS idx_rolls_code    ON rolls (roll_code);
  CREATE INDEX IF NOT EXISTS idx_rolls_inward  ON rolls (inward_transaction_id);

  -- ─── Inward transaction items ───────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS inward_transaction_items (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    inward_transaction_id INTEGER NOT NULL REFERENCES inward_transactions(id),
    roll_id               INTEGER NOT NULL REFERENCES rolls(id),
    received_length_mm    INTEGER NOT NULL CHECK (received_length_mm > 0)
  );

  CREATE INDEX IF NOT EXISTS idx_inward_items_tx   ON inward_transaction_items (inward_transaction_id);
  CREATE INDEX IF NOT EXISTS idx_inward_items_roll ON inward_transaction_items (roll_id);

  -- ─── Outward transactions ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS outward_transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    godown_id           INTEGER NOT NULL DEFAULT 1 REFERENCES godowns(id),
    slip_number         TEXT    NOT NULL UNIQUE,
    transaction_date    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    recipient_reference TEXT    NOT NULL DEFAULT '',
    notes               TEXT    NOT NULL DEFAULT '',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_outward_godown ON outward_transactions (godown_id);
  CREATE INDEX IF NOT EXISTS idx_outward_slip   ON outward_transactions (slip_number);
  CREATE INDEX IF NOT EXISTS idx_outward_date   ON outward_transactions (transaction_date);

  -- ─── Outward transaction items ──────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS outward_transaction_items (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    outward_transaction_id INTEGER NOT NULL REFERENCES outward_transactions(id),
    roll_id                INTEGER NOT NULL REFERENCES rolls(id),
    issued_length_mm       INTEGER NOT NULL CHECK (issued_length_mm > 0),
    UNIQUE (outward_transaction_id, roll_id)
  );

  CREATE INDEX IF NOT EXISTS idx_outward_items_tx   ON outward_transaction_items (outward_transaction_id);
  CREATE INDEX IF NOT EXISTS idx_outward_items_roll ON outward_transaction_items (roll_id);

  -- ─── Roll history ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS roll_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_id             INTEGER NOT NULL REFERENCES rolls(id),
    godown_id           INTEGER NOT NULL REFERENCES godowns(id),
    transaction_type    TEXT    NOT NULL CHECK (transaction_type IN ('inward', 'outward')),
    transaction_id      INTEGER NOT NULL,
    slip_number         TEXT    NOT NULL,
    event_timestamp     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    length_involved_mm  INTEGER NOT NULL CHECK (length_involved_mm > 0),
    recipient_reference TEXT    NOT NULL DEFAULT '',
    notes               TEXT    NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_roll_history_roll   ON roll_history (roll_id);
  CREATE INDEX IF NOT EXISTS idx_roll_history_godown ON roll_history (godown_id);
  CREATE INDEX IF NOT EXISTS idx_roll_history_date   ON roll_history (event_timestamp);
`;

// ─── Migration 002: Application settings ────────────────────────────────────

const migration_002 = `
  CREATE TABLE IF NOT EXISTS application_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- Seed default settings
  INSERT OR IGNORE INTO application_settings (key, value) VALUES
    ('shop_name',    'Leather Warehouse'),
    ('shop_address', 'Shah Alam Market, Lahore, Pakistan'),
    ('shop_contact', ''),
    ('print_mode',   'a4'),
    ('date_format',  'DD/MM/YYYY');
`;

// ─── Migration 003: Upgrade existing databases ──────────────────────────────

function migration_003_fn(database) {
  // Ensure godowns table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS godowns (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      address     TEXT    NOT NULL DEFAULT '',
      is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    INSERT OR IGNORE INTO godowns (id, name, address) VALUES
      (1, 'Godown 1 — Main Warehouse', 'Shah Alam Market, Lahore'),
      (2, 'Godown 2 — Shah Alam Store', 'Circular Road, Lahore');
  `);

  // Helper to check if column exists
  const hasColumn = (tableName, colName) => {
    const cols = database.prepare(`PRAGMA table_info(${tableName})`).all();
    return cols.some(c => c.name.toLowerCase() === colName.toLowerCase());
  };

  if (!hasColumn('inward_transactions', 'godown_id')) {
    database.exec(`ALTER TABLE inward_transactions ADD COLUMN godown_id INTEGER DEFAULT 1;`);
    database.exec(`UPDATE inward_transactions SET godown_id = 1 WHERE godown_id IS NULL;`);
    database.exec(`CREATE INDEX IF NOT EXISTS idx_inward_godown ON inward_transactions (godown_id);`);
  }

  if (!hasColumn('rolls', 'godown_id')) {
    database.exec(`ALTER TABLE rolls ADD COLUMN godown_id INTEGER DEFAULT 1;`);
    database.exec(`UPDATE rolls SET godown_id = 1 WHERE godown_id IS NULL;`);
    database.exec(`CREATE INDEX IF NOT EXISTS idx_rolls_godown ON rolls (godown_id);`);
  }

  if (!hasColumn('outward_transactions', 'godown_id')) {
    database.exec(`ALTER TABLE outward_transactions ADD COLUMN godown_id INTEGER DEFAULT 1;`);
    database.exec(`UPDATE outward_transactions SET godown_id = 1 WHERE godown_id IS NULL;`);
    database.exec(`CREATE INDEX IF NOT EXISTS idx_outward_godown ON outward_transactions (godown_id);`);
  }

  // Ensure transaction items tables exist
  database.exec(`
    CREATE TABLE IF NOT EXISTS inward_transaction_items (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      inward_transaction_id INTEGER NOT NULL REFERENCES inward_transactions(id),
      roll_id               INTEGER NOT NULL REFERENCES rolls(id),
      received_length_mm    INTEGER NOT NULL CHECK (received_length_mm > 0)
    );

    CREATE TABLE IF NOT EXISTS outward_transaction_items (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      outward_transaction_id INTEGER NOT NULL REFERENCES outward_transactions(id),
      roll_id                INTEGER NOT NULL REFERENCES rolls(id),
      issued_length_mm       INTEGER NOT NULL CHECK (issued_length_mm > 0),
      UNIQUE (outward_transaction_id, roll_id)
    );
  `);

  // Ensure roll_history exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS roll_history (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_id             INTEGER NOT NULL REFERENCES rolls(id),
      godown_id           INTEGER NOT NULL REFERENCES godowns(id),
      transaction_type    TEXT    NOT NULL CHECK (transaction_type IN ('inward', 'outward')),
      transaction_id      INTEGER NOT NULL,
      slip_number         TEXT    NOT NULL,
      event_timestamp     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      length_involved_mm  INTEGER NOT NULL CHECK (length_involved_mm > 0),
      recipient_reference TEXT    NOT NULL DEFAULT '',
      notes               TEXT    NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_roll_history_roll   ON roll_history (roll_id);
    CREATE INDEX IF NOT EXISTS idx_roll_history_godown ON roll_history (godown_id);
    CREATE INDEX IF NOT EXISTS idx_roll_history_date   ON roll_history (event_timestamp);
  `);

  // Helper to check table exists
  const hasTable = (tableName) => {
    return !!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
  };

  // Backfill roll_history if empty
  const histCount = database.prepare('SELECT COUNT(*) as cnt FROM roll_history').get();
  if (histCount.cnt === 0) {
    // Inward events
    if (hasTable('rolls') && hasTable('inward_transactions')) {
      database.exec(`
        INSERT INTO roll_history (roll_id, godown_id, transaction_type, transaction_id, slip_number, event_timestamp, length_involved_mm, notes)
        SELECT r.id, COALESCE(r.godown_id, 1), 'inward', it.id, it.slip_number, it.transaction_date, r.original_length_mm, it.notes
        FROM rolls r
        JOIN inward_transactions it ON it.id = r.inward_transaction_id;
      `);
    }

    // Outward events
    if (hasTable('outward_transaction_items') && hasTable('outward_transactions')) {
      database.exec(`
        INSERT INTO roll_history (roll_id, godown_id, transaction_type, transaction_id, slip_number, event_timestamp, length_involved_mm, recipient_reference, notes)
        SELECT oti.roll_id, COALESCE(ot.godown_id, 1), 'outward', ot.id, ot.slip_number, ot.transaction_date, oti.issued_length_mm, ot.recipient_reference, ot.notes
        FROM outward_transaction_items oti
        JOIN outward_transactions ot ON ot.id = oti.outward_transaction_id;
      `);
    }
  }
}

// ─── Migration 004: Supplier Bills & Pending Roll Verification ───────────────

const migration_004 = `
  -- Supplier bill header
  CREATE TABLE IF NOT EXISTS supplier_bills (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    godown_id       INTEGER NOT NULL REFERENCES godowns(id),
    bill_number     TEXT    NOT NULL DEFAULT '',
    bill_date       TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_supplier_bills_godown ON supplier_bills (godown_id);
  CREATE INDEX IF NOT EXISTS idx_supplier_bills_number ON supplier_bills (bill_number);
  CREATE INDEX IF NOT EXISTS idx_supplier_bills_date   ON supplier_bills (bill_date);

  -- Per-product lines on a supplier bill
  CREATE TABLE IF NOT EXISTS supplier_bill_items (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_bill_id            INTEGER NOT NULL REFERENCES supplier_bills(id) ON DELETE CASCADE,
    product_id                  INTEGER NOT NULL REFERENCES products(id),
    supplier_total_meters       REAL    NOT NULL CHECK (supplier_total_meters > 0),
    supplier_total_rolls        INTEGER NOT NULL CHECK (supplier_total_rolls > 0),
    verification_status         TEXT    NOT NULL DEFAULT 'pending'
                                        CHECK (verification_status IN ('pending','partial','verified','discrepancy')),
    verified_rolls              INTEGER NOT NULL DEFAULT 0,
    verified_meters             REAL    NOT NULL DEFAULT 0,
    inward_transaction_id       INTEGER REFERENCES inward_transactions(id),
    notes                       TEXT    NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_bill_items_bill    ON supplier_bill_items (supplier_bill_id);
  CREATE INDEX IF NOT EXISTS idx_bill_items_product ON supplier_bill_items (product_id);
  CREATE INDEX IF NOT EXISTS idx_bill_items_status  ON supplier_bill_items (verification_status);
`;

function migration_005_fn(database) {
  const addColumnIfNotExists = (table, column, def) => {
    const cols = database.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
  };

  addColumnIfNotExists('inward_transactions', 'rate_per_meter', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('inward_transactions', 'total_price', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('rolls', 'purchase_rate', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('inward_transaction_items', 'rate_per_meter', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('inward_transaction_items', 'total_price', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('outward_transactions', 'rate_per_meter', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('outward_transactions', 'total_price', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('outward_transaction_items', 'rate_per_meter', 'REAL NOT NULL DEFAULT 0');
  addColumnIfNotExists('outward_transaction_items', 'total_price', 'REAL NOT NULL DEFAULT 0');
}

const migration_006 = `
  CREATE TABLE IF NOT EXISTS application_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  INSERT OR REPLACE INTO application_settings (key, value, updated_at)
  VALUES ('shop_name', 'Haji Rafiq Phoga Leather Shop', datetime('now', 'localtime'));
`;

module.exports = { initDatabase, getDb, closeDatabase, getDbPath };

