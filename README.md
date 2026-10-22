# Haji Rafiq Phoga Leather Shop — Warehouse Stock Management System
### حاجی رفیق پھوگا لیدر شاپ — شاہ عالم مارکیٹ، لاہور
**Offline-First, Keyboard-First Desktop Application for Wholesale Leather Warehouse & Multi-Godown Stock Management**

Built with **Electron 33**, **React 18**, **TypeScript**, and **SQLite (better-sqlite3)** with WAL mode, foreign keys, and atomic database transactions.

---

## 🌟 Overview & Key Features

This application is purpose-built for the fast-paced wholesale leather market in **Shah Alam Market, Lahore, Pakistan**. It features a bilingual interface (English and Urdu/Roman Urdu), high-contrast luxury UI, large interactive touchpoints, and a 100% **Keyboard-First** operating workflow so users can operate the entire warehouse without touching the mouse.

---

### 1. 🏢 Multi-Godown Architecture (Strict Data Isolation)
- **Unlimited Godowns:** Create and manage separate locations (e.g., *Godown 1 — Main Warehouse*, *Godown 2 — Shah Alam Store*).
- **Strict Isolation:** Every physical roll, transaction, stock count, and audit history entry belongs strictly to one godown.
- **Cross-Godown Protection:** Attempting to dispatch a roll belonging to Godown 1 while operating in Godown 2 is rejected at the database transaction level.
- **Overall vs. Godown View:** Switch between single-godown view and a consolidated overview of all godowns with one keystroke (`Alt+O`).

---

### 2. 📏 Roll Size Grouping & Accurate Stock Bars
- **Grouped by Size & Product:** Instead of displaying endless individual rows, rolls are automatically aggregated into clean hero bars:
  > **`35.00 m Roll`** | **`black (192)`** | **`🟢 10 Quantity Left`** | **`Kul Lambai: 350.00 m`** | **`💰 Price: Rs. 700 / m`**
- **Keyboard Expandable (`Enter`):** Pressing <kbd>Enter</kbd> or clicking any bar smoothly expands the drawer to display individual roll codes (`192-0001` through `192-0010`) and full movement history.
- **Integer Millimeter Precision:** Stored internally in integer millimeters (`mm = Math.round(meters * 1000)`) to eliminate floating-point calculation discrepancies.

---

### 3. 📥 Incoming Stock Workflow (Maal Andar Aaye)
- **Supplier Bills & Inward Slips:** Record supplier bill numbers, product codes, total meters, and roll counts.
- **Mode A (Fast Direct Entry):** Enter total rolls and meters directly.
- **Mode B (Bulk Batch Entry):** Enter roll size batches (e.g., 10 rolls of 35m + 10 rolls of 50m).
- **Integrated Purchase Pricing:** Track rate per meter (`Rs. 700 / m`) and total supplier bill amount.
- **Instant Printable Inward Slip:** Generates professional A4/thermal printable slips with shop details, godown name, slip number, and roll breakdowns.

---

### 4. 📤 Outgoing Dispatch Workflow (Maal Bahar Jaye)
- **Fast Barcode / Roll Scanner:** Scan roll barcodes or type roll codes with instant <kbd>Enter</kbd> selection.
- **Quick Dispatch from Stock Bars:**
  - `+ 1 Roll` quick add button.
  - `+ All (10)` select entire batch.
  - Interactive roll drawer for manual pick-and-choose.
- **Dynamic Pricing Calculator:** Real-time bidirectional calculation between rate per meter (`Rs./m`) and total sale bill amount (`Total Price`).
- **Instant Printable Outward Slip:** Generates gate passes and delivery challans with customer references, roll lists, and authorized signature lines.

---

### 5. ⚡ Complete Keyboard-First Shortcuts

| Shortcut | Description |
| :--- | :--- |
| <kbd>F1</kbd> / <kbd>Alt+1</kbd> | Go to **Dashboard** |
| <kbd>F2</kbd> / <kbd>Alt+2</kbd> | Go to **Godowns Management** |
| <kbd>F3</kbd> / <kbd>Alt+3</kbd> | Go to **Current Stock** |
| <kbd>F4</kbd> / <kbd>Alt+4</kbd> | Open **Incoming Stock (Maal Andar)** |
| <kbd>F5</kbd> / <kbd>Alt+5</kbd> | Open **Outgoing Dispatch (Maal Bahar)** |
| <kbd>F6</kbd> / <kbd>Alt+6</kbd> | Go to **Products &amp; Catalogue** |
| <kbd>F7</kbd> / <kbd>Alt+7</kbd> | Open **Stock History &amp; Audit Log** |
| <kbd>F8</kbd> / <kbd>Alt+8</kbd> | Go to **Settings &amp; Backup** |
| <kbd>Alt+O</kbd> | Switch to **Tamam Godowns (Overall)** View |
| <kbd>Alt+S</kbd> | Focus **Roll Barcode / ID Search** |
| <kbd>Alt+P</kbd> | Focus **Product Selection** |
| <kbd>Alt+C</kbd> | Focus **Customer / Recipient Input** |
| <kbd>Alt+R</kbd> | Focus **Rate Per Meter Input** |
| <kbd>Alt+T</kbd> | Focus **Total Price Bill Input** |
| <kbd>Ctrl+S</kbd> | **Confirm &amp; Save** Transaction |
| <kbd>Ctrl+P</kbd> | **Print Slip** |
| <kbd>Enter</kbd> | Open / Expand Bar, Add Roll to Cart, View History |
| <kbd>Esc</kbd> | Close Modal / Cancel |

---

### 6. 🛡️ Data Safety, Audit Log & Backup
- **Automated Roll Audit Trail:** Every roll transition (receipt, transfer, dispatch) is permanently logged with timestamps in `Asia/Karachi` timezone.
- **One-Click SQLite Backup:** Creates unfragmented SQLite database snapshots (`VACUUM INTO`).
- **Safe Database Restoration:** Automated verification of SQLite headers, with automatic safety backup creation (`warehouse.db.safety-[timestamp].bak`) before swapping files.

---

## 🛠️ Technology Stack

- **Runtime:** Electron 33 (`contextIsolation: true`, `nodeIntegration: false`, secure preload bridge)
- **Frontend:** React 18, TypeScript (Strict Mode), Vite 6, Bootstrap 5, Lucide Icons
- **Database:** SQLite 3 via `better-sqlite3` (WAL Mode enabled)
- **Packaging:** Electron Builder (Windows NSIS Installer)
- **Testing:** Jest & ts-jest (32 Automated Acceptance & Core Logic Tests)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- Windows 10/11 (or macOS/Linux for development)

### Installation
```bash
# Clone repository
git clone https://github.com/fahad-khaliq-261/stock-manegment.git
cd stock-manegment

# Install dependencies
npm install --legacy-peer-deps
```

### Running Locally
```bash
# Run Vite React development server
npm run dev

# Run Electron desktop application
npm start
```

### Running Tests
```bash
# Run all 32 automated acceptance tests
npm test
```

### Building Windows Installer
```bash
# Build production bundle and compile NSIS installer
npm run package
```
Installer outputs to: `release/Leather Warehouse WMS Setup 1.0.0.exe`

---

## 📂 Project Directory Structure

```
raxine-shop-pos/
├── electron/
│   ├── database/
│   │   └── init.cjs            # SQLite schema, migrations (1-6) & connection
│   ├── ipc/
│   │   ├── godownHandlers.cjs  # Godowns CRUD
│   │   ├── productHandlers.cjs # Products CRUD
│   │   ├── stockHandlers.cjs   # Inventory, grouped stock & batch rates
│   │   ├── inwardHandlers.cjs  # Inward receipts & supplier bills
│   │   ├── outwardHandlers.cjs # Outward dispatch & slip generation
│   │   ├── printHandlers.cjs   # Professional HTML slip printer
│   │   └── settingsHandlers.cjs# Settings, backup, restore & factory reset
│   ├── repositories/           # Isolated data access repositories
│   ├── main.cjs                # Electron window lifecycle & IPC registration
│   └── preload.cjs             # Secure ContextBridge API exposure
├── src/
│   ├── components/             # Reusable UI & Roll History Modals
│   ├── contexts/               # GodownContext & ToastContext
│   ├── pages/
│   │   ├── DashboardPage.tsx   # Premium shop dashboard & metrics
│   │   ├── InwardPage.tsx      # Mode A & Mode B incoming stock
│   │   ├── OutwardPage.tsx     # Fast dispatch & grouped available stock
│   │   ├── CurrentStockPage.tsx# Grouped size bars & live rate editor
│   │   ├── GodownsPage.tsx     # Multi-godown management
│   │   ├── ProductsPage.tsx    # Product catalogue
│   │   ├── StockHistoryPage.tsx# Audit trail & slip reprint
│   │   └── SettingsPage.tsx    # Shop branding & database backup
│   ├── api.ts                  # Fully typed Electron IPC bridge
│   ├── App.tsx                 # Main layout, sidebar navigation & shortcuts
│   └── index.css               # Design system & high-contrast styling
├── tests/
│   └── warehouse.test.ts       # 32 comprehensive acceptance tests
├── package.json
└── vite.config.ts
```

---

## 📜 License & Ownership
Designed and implemented for **Haji Rafiq Phoga Leather Shop**, Shah Alam Market, Lahore, Pakistan.
All rights reserved.
