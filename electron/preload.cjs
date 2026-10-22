'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload bridge — exposes a narrow, explicitly named API to the React renderer.
 * NO arbitrary IPC channels. NO unrestricted Node.js APIs.
 * All calls go through validated IPC handlers in the main process.
 */

const validChannels = {
  // Godowns
  'godowns:list': true,
  'godowns:create': true,
  'godowns:update': true,
  'godowns:getById': true,

  // Products
  'products:list': true,
  'products:create': true,
  'products:update': true,
  'products:getById': true,
  'products:getStockSummary': true,

  // Rolls
  'rolls:listByProduct': true,
  'rolls:listAvailable': true,
  'rolls:getById': true,
  'rolls:getByCode': true,
  'rolls:getHistory': true,

  // Inward transactions
  'inward:create': true,
  'inward:list': true,
  'inward:getById': true,

  // Outward transactions
  'outward:create': true,
  'outward:list': true,
  'outward:getById': true,

  // Stock
  'stock:summary': true,
  'stock:dashboard': true,
  'stock:rollInventory': true,

  // History
  'history:list': true,
  'history:getBySlip': true,

  // Settings
  'settings:get': true,
  'settings:set': true,
  'settings:factoryReset': true,

  // Backup / Restore
  'backup:create': true,
  'backup:restore': true,

  // Print
  'print:inwardSlip': true,
  'print:outwardSlip': true,
};

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Send an IPC message and wait for the response.
   * Only whitelisted channels are allowed.
   */
  invoke: (channel, ...args) => {
    if (validChannels[channel]) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`IPC channel not allowed: ${channel}`);
  },

  /**
   * Listen to an IPC event from the main process.
   * Only whitelisted channels are allowed.
   */
  on: (channel, callback) => {
    if (validChannels[channel]) {
      const listener = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    throw new Error(`IPC channel not allowed: ${channel}`);
  },

  // Platform info (safe, read-only)
  platform: process.platform,
});
