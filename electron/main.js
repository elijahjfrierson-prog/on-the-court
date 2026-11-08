// On The Court — desktop shell. Crash-safe: renderer/GPU crashes auto-recover.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-background-timer-throttling');
const selftest = process.argv.includes('--selftest');
if (selftest) { app.commandLine.appendSwitch('use-angle', 'swiftshader'); app.commandLine.appendSwitch('enable-unsafe-swiftshader'); }
let win, restarts = 0;
function logFile() { try { return path.join(app.getPath('userData'), 'crash.log'); } catch { return null; } }
function log(msg) { const f = logFile(); if (f) try { fs.appendFileSync(f, new Date().toISOString() + ' ' + msg + '\n'); } catch {} }
function create() {
  win = new BrowserWindow({ width: 1600, height: 900, minWidth: 960, minHeight: 540, backgroundColor: '#05060b', title: 'On The Court', show: !selftest,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: selftest ? { selftest: '1', q: 'Low' } : {} });
  win.webContents.on('render-process-gone', (_e, d) => { log('renderer gone: ' + d.reason); if (selftest) { console.error('RENDERER_GONE', d.reason); app.exit(2); } else if (restarts++ < 5) win.reload(); });
  win.webContents.on('unresponsive', () => { log('unresponsive'); });
  win.webContents.on('console-message', (_e, level, message) => {
    if (selftest) { console.log('[page]', message); if (message.includes('OTC_SELFTEST_OK')) app.exit(0); if (message.includes('OTC_SELFTEST_FAIL')) app.exit(3); }
  });
  win.on('enter-full-screen', () => {}); 
}
app.on('child-process-gone', (_e, d) => { log('child gone: ' + d.type + ' ' + d.reason); if (d.type === 'GPU' && !selftest && restarts++ < 5 && win) win.reload(); });
app.whenReady().then(() => { create(); if (selftest) setTimeout(() => { console.error('SELFTEST_TIMEOUT'); app.exit(4); }, 90000); });
app.on('window-all-closed', () => app.quit());
