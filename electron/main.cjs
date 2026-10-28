'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow = null;

// Determine if we are in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Leather Warehouse Management System',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // needed for preload to access Node APIs
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize DB after app is ready
app.whenReady().then(async () => {
  // Initialize database before creating window
  const { initDatabase } = require('./database/init.cjs');
  try {
    initDatabase();
  } catch (err) {
    console.error('Database initialization failed:', err);
    dialog.showErrorBox('Database Error', `Failed to initialize database: ${err.message}`);
    app.quit();
    return;
  }

  // Register all IPC handlers
  require('./ipc/godownHandlers.cjs');
  require('./ipc/productHandlers.cjs');
  require('./ipc/variantHandlers.cjs');
  require('./ipc/bulkLotHandlers.cjs');
  require('./ipc/inwardHandlers.cjs');
  require('./ipc/outwardHandlers.cjs');
  require('./ipc/stockHandlers.cjs');
  require('./ipc/historyHandlers.cjs');
  require('./ipc/settingsHandlers.cjs');
  require('./ipc/backupHandlers.cjs');
  require('./ipc/printHandlers.cjs');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Export mainWindow getter for use in other modules
module.exports = { getMainWindow: () => mainWindow };
