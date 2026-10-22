'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const { getInwardTransactionById } = require('../services/inwardService.cjs');
const { getOutwardTransactionById } = require('../services/outwardService.cjs');
const { getDb } = require('../database/init.cjs');

function getSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM application_settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function generateInwardSlipHtml(tx, settings) {
  const items = tx.items || [];
  const totalRolls = items.length;
  const totalMeters = items.reduce((sum, i) => sum + (i.received_length_meters || 0), 0);

  const rows = items.map(item => `
    <tr>
      <td style="font-weight: bold; font-family: monospace; font-size: 13px;">${item.roll_code || ''}</td>
      <td class="text-end" style="font-weight: bold;">${(item.received_length_meters || 0).toFixed(2)} m</td>
      <td>${item.product_name || ''} (${item.product_code || ''})</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Inward Slip - ${tx.slip_number}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .shop-name { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
  .shop-address { font-size: 11px; color: #444; margin-top: 2px; }
  .godown-box { background: #f0f4f8; border: 1.5px solid #2b4c7e; padding: 8px 12px; margin: 12px 0; border-radius: 6px; }
  .godown-title { font-size: 13px; font-weight: bold; color: #1a365d; }
  .godown-addr { font-size: 11px; color: #4a5568; }
  .slip-title { font-size: 15px; font-weight: bold; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 1px; color: #2e7d32; }
  .slip-meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #2b4c7e; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { border: 1px solid #cbd5e0; padding: 7px 10px; font-size: 12px; }
  .text-end { text-align: right; }
  .totals { margin: 16px 0; font-size: 13px; border-top: 2px solid #2b4c7e; border-bottom: 2px solid #2b4c7e; padding: 8px 0; }
  .totals p { margin: 4px 0; }
  .totals strong { display: inline-block; width: 180px; }
  .notes { font-size: 11px; margin-bottom: 16px; color: #4a5568; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-block { text-align: center; width: 40%; }
  .sig-line { border-top: 1px solid #000; padding-top: 6px; margin-top: 40px; font-size: 11px; font-weight: bold; }
  .badge { display: inline-block; background: #e8f5e9; border: 1.5px solid #4caf50; color: #2e7d32; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <div class="shop-name">${settings.shop_name || 'Haji Rafiq Phoga Leather Shop'}</div>
    <div class="shop-address">${settings.shop_address || 'Shah Alam Market, Lahore, Pakistan'}</div>
    ${settings.shop_contact ? `<div class="shop-address">Phone: ${settings.shop_contact}</div>` : ''}
    <div class="slip-title">&#x2193; Inward Stock Slip (Maal Andar Slip)</div>
  </div>

  <div class="godown-box">
    <div class="godown-title">&#127970; Godown: ${tx.godown_name || 'Main Warehouse'}</div>
    ${tx.godown_address ? `<div class="godown-addr">Location: ${tx.godown_address}</div>` : ''}
  </div>

  <div class="slip-meta">
    <span><strong>Slip No:</strong> ${tx.slip_number}</span>
    <span><strong>Date &amp; Time:</strong> ${formatDate(tx.transaction_date)}</span>
    <span class="badge">INWARD / ANDAR</span>
  </div>

  ${tx.reference_note ? `<p class="notes"><strong>Source / Reference:</strong> ${tx.reference_note}</p>` : ''}

  <table>
    <thead>
      <tr>
        <th>Roll ID</th>
        <th class="text-end">Length</th>
        <th>Product</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <p><strong>Total Rolls Received:</strong> ${totalRolls}</p>
    <p><strong>Total Meters Received:</strong> ${totalMeters.toFixed(2)} m</p>
    ${tx.rate_per_meter > 0 ? `<p><strong>Rate Per Meter:</strong> Rs. ${Number(tx.rate_per_meter).toFixed(2)} / m</p>` : ''}
    ${tx.total_price > 0 ? `<p><strong>Total Price / Amount:</strong> Rs. ${Number(tx.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ''}
  </div>

  ${tx.notes ? `<p class="notes"><strong>Notes:</strong> ${tx.notes}</p>` : ''}

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line">Prepared By (Tayyar Karda)</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Received By (Wasool Karda)</div>
    </div>
  </div>
</body>
</html>`;
}

function generateOutwardSlipHtml(tx, settings) {
  const items = tx.items || [];
  const totalRolls = items.length;
  const totalMeters = items.reduce((sum, i) => sum + (i.issued_length_meters || 0), 0);

  const rows = items.map(item => `
    <tr>
      <td style="font-weight: bold; font-family: monospace; font-size: 13px;">${item.roll_code || ''}</td>
      <td class="text-end" style="font-weight: bold;">${(item.issued_length_meters || 0).toFixed(2)} m</td>
      <td>${item.product_name || ''} (${item.product_code || ''})</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Outward Slip - ${tx.slip_number}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .shop-name { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
  .shop-address { font-size: 11px; color: #444; margin-top: 2px; }
  .godown-box { background: #fff8e1; border: 1.5px solid #ff8f00; padding: 8px 12px; margin: 12px 0; border-radius: 6px; }
  .godown-title { font-size: 13px; font-weight: bold; color: #b78103; }
  .godown-addr { font-size: 11px; color: #5d4037; }
  .slip-title { font-size: 15px; font-weight: bold; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 1px; color: #e65100; }
  .slip-meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #b78103; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { border: 1px solid #cbd5e0; padding: 7px 10px; font-size: 12px; }
  .text-end { text-align: right; }
  .totals { margin: 16px 0; font-size: 13px; border-top: 2px solid #ff8f00; border-bottom: 2px solid #ff8f00; padding: 8px 0; }
  .totals p { margin: 4px 0; }
  .totals strong { display: inline-block; width: 180px; }
  .notes { font-size: 11px; margin-bottom: 12px; color: #4a5568; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-block { text-align: center; width: 40%; }
  .sig-line { border-top: 1px solid #000; padding-top: 6px; margin-top: 40px; font-size: 11px; font-weight: bold; }
  .badge { display: inline-block; background: #fff3e0; border: 1.5px solid #ff9800; color: #e65100; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <div class="shop-name">${settings.shop_name || 'Haji Rafiq Phoga Leather Shop'}</div>
    <div class="shop-address">${settings.shop_address || 'Shah Alam Market, Lahore, Pakistan'}</div>
    ${settings.shop_contact ? `<div class="shop-address">Phone: ${settings.shop_contact}</div>` : ''}
    <div class="slip-title">&#x2191; Outward Stock Slip (Maal Bahar Slip)</div>
  </div>

  <div class="godown-box">
    <div class="godown-title">&#127970; Issued From Godown: ${tx.godown_name || 'Main Warehouse'}</div>
    ${tx.godown_address ? `<div class="godown-addr">Location: ${tx.godown_address}</div>` : ''}
  </div>

  <div class="slip-meta">
    <span><strong>Slip No:</strong> ${tx.slip_number}</span>
    <span><strong>Date &amp; Time:</strong> ${formatDate(tx.transaction_date)}</span>
    <span class="badge">OUTWARD / BAHAR</span>
  </div>

  ${tx.recipient_reference ? `<p class="notes"><strong>Recipient / Reference:</strong> ${tx.recipient_reference}</p>` : ''}

  <table>
    <thead>
      <tr>
        <th>Roll ID</th>
        <th class="text-end">Length Issued</th>
        <th>Product</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <p><strong>Total Rolls Issued:</strong> ${totalRolls}</p>
    <p><strong>Total Meters Issued:</strong> ${totalMeters.toFixed(2)} m</p>
    ${tx.rate_per_meter > 0 ? `<p><strong>Sale Rate Per Meter:</strong> Rs. ${Number(tx.rate_per_meter).toFixed(2)} / m</p>` : ''}
    ${tx.total_price > 0 ? `<p><strong>Total Bill / Sale Amount:</strong> Rs. ${Number(tx.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ''}
  </div>

  ${tx.notes ? `<p class="notes"><strong>Notes:</strong> ${tx.notes}</p>` : ''}

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line">Issued By (Jari Karda)</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Customer / Receiver Signature</div>
    </div>
  </div>
</body>
</html>`;
}

async function printSlip(htmlContent, title) {
  return new Promise((resolve, reject) => {
    const printWin = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    printWin.webContents.once('did-finish-load', () => {
      printWin.webContents.print(
        {
          silent: false,
          printBackground: true,
          margins: { marginType: 'none' },
        },
        (success, failureReason) => {
          printWin.close();
          if (success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: failureReason || 'Print failed.' });
          }
        }
      );
    });

    printWin.webContents.once('crashed', () => {
      reject(new Error('Print window crashed.'));
    });
  });
}

if (ipcMain) {
  ipcMain.handle('print:inwardSlip', async (_event, transactionId) => {
    try {
      const tx = getInwardTransactionById(transactionId);
      if (!tx) return { success: false, error: 'Transaction not found.' };
      const settings = getSettings();
      const html = generateInwardSlipHtml(tx, settings);
      return await printSlip(html, `Inward Slip ${tx.slip_number}`);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('print:outwardSlip', async (_event, transactionId) => {
    try {
      const tx = getOutwardTransactionById(transactionId);
      if (!tx) return { success: false, error: 'Transaction not found.' };
      const settings = getSettings();
      const html = generateOutwardSlipHtml(tx, settings);
      return await printSlip(html, `Outward Slip ${tx.slip_number}`);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { generateInwardSlipHtml, generateOutwardSlipHtml };
