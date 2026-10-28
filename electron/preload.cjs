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

  // Stock variants (product + godown + roll size + price -> quantity)
  'variants:listByProduct': true,
  'variants:listAll': true,
  'variants:getById': true,
  'variants:updateRate': true,
  'variants:getMovements': true,

  // Bulk lots (product + godown + price -> total meters + roll count, no fixed roll size)
  'bulk:listByProduct': true,
  'bulk:listAll': true,
  'bulk:getById': true,
  'bulk:updateRate': true,
  'bulk:getMovements': true,

  // Inward transactions
  'inward:create': true,
  'inward:createBulk': true,
  'inward:list': true,
  'inward:getById': true,
  'inward:productStock': true,

  // Outward transactions
  'outward:create': true,
  'outward:list': true,
  'outward:getById': true,

  // Stock
  'stock:dashboard': true,
  'stock:lowStock': true,

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
