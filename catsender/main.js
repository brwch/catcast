const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { startStreamingServer } = require('./server');
const { screenCapture } = require('./screen-capturer');
const QRCode = require('qrcode');

log.transports.file.level = 'info';
log.transports.console.level = 'info';

autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const store = new Store({
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    serverPort: 8080,
    quality: 'high',
    fps: 60,
    captureSource: 'screen',
    selectedMonitor: 0,
    selectedWindow: null,
    selectedFile: null,
    autoStart: false,
    minimizeToTray: true,
    enableAudio: false,
    hotkeys: {
      startStop: 'Ctrl+Shift+S',
      pauseResume: 'Ctrl+Shift+P',
      toggleFullscreen: 'F11'
    },
    theme: 'dark',
    language: 'pl',
    bestEncoder: null
  }
});

let mainWindow;
let tray = null;
let isStreaming = false;
let serverInstance = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// snap to closest standard resolution if within threshold
function snapToStandard(val, threshold = 15) {
  const standards = [0, 640, 480, 800, 600, 1024, 768, 1280, 720, 1366, 768, 1440, 900, 1600, 900, 1680, 1050, 1920, 1080, 2560, 1440, 3840, 2160];
  const absVal = Math.abs(val);
  const sign = val < 0 ? -1 : 1;

  for (const s of standards) {
    if (Math.abs(absVal - s) <= threshold) return sign * s;
  }
  return val;
}

function getMonitorsInfo() {
  const displays = screen.getAllDisplays();

  return displays.map((display, index) => {

    const scale = display.scaleFactor || 1;

    // calculate physical pixels and snap to common resolutions to avoid 1px gaps/black screens
    let physicalWidth = snapToStandard(Math.round(display.bounds.width * scale));
    let physicalHeight = snapToStandard(Math.round(display.bounds.height * scale));
    let physicalX = snapToStandard(Math.round(display.bounds.x * scale));
    let physicalY = snapToStandard(Math.round(display.bounds.y * scale));

    // ensure even dimensions
    physicalWidth = physicalWidth % 2 === 0 ? physicalWidth : physicalWidth - 1;
    physicalHeight = physicalHeight % 2 === 0 ? physicalHeight : physicalHeight - 1;

    return {
      id: index,
      bounds: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight },
      size: { width: physicalWidth, height: physicalHeight },
      scaleFactor: scale,
      label: `Monitor ${index + 1} (${physicalWidth}x${physicalHeight})`
    };
  });
}

function createWindow() {
  const { width, height } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 800,
    minHeight: 640,
    icon: path.join(__dirname, 'assets', 'icons', 'Icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile('index.html');

  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Block DevTools
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault();
      }
      if (input.key === 'F12') {
        event.preventDefault();
      }
      // Block Reload
      if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
        event.preventDefault();
      }
      if (input.key === 'F5') {
        event.preventDefault();
      }
    });
  }

  createApplicationMenu();

  createTray();

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // check for updates
    if (process.env.NODE_ENV !== 'development') {
      setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 2000);
    }
  });

  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && !app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    app.isQuiting = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('resize', () => {
    if (mainWindow) {
      const { width, height } = mainWindow.getBounds();
      store.set('windowBounds', { width, height });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  let lastMaximizeTime = 0;
  ipcMain.on('maximize-window', () => {
    const now = Date.now();
    if (now - lastMaximizeTime < 500) return; // debounce 500ms
    lastMaximizeTime = now;

    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      mainWindow.webContents.send('window-maximized', mainWindow.isMaximized());
    }
  });

  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),

    // file menu
    {
      label: 'Plik',
      submenu: [
        {
          label: 'Wybierz plik wideo...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('select-file')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // edit menu
    {
      label: 'Edycja',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Mowa',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },

    // view menu
    {
      label: 'Widok',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(process.env.NODE_ENV === 'development' ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // stream menu
    {
      label: 'Transmisja',
      submenu: [
        {
          label: 'Rozpocznij transmisję',
          accelerator: store.get('hotkeys.startStop'),
          enabled: !isStreaming,
          click: () => mainWindow.webContents.send('start-stream')
        },
        {
          label: 'Zatrzymaj transmisję',
          accelerator: store.get('hotkeys.startStop'),
          enabled: isStreaming,
          click: () => mainWindow.webContents.send('stop-stream')
        },
        { type: 'separator' },
        {
          label: 'Pauzuj/Wznów',
          accelerator: store.get('hotkeys.pauseResume'),
          enabled: isStreaming,
          click: () => mainWindow.webContents.send('toggle-pause')
        }
      ]
    },

    // window menu
    {
      label: 'Okno',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },

    // help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Dokumentacja',
          click: async () => {
            await shell.openExternal('https://github.com/bruno/lg-cast');
          }
        },
        {
          label: 'Sprawdź aktualizacje',
          click: () => autoUpdater.checkForUpdatesAndNotify()
        },
        { type: 'separator' },
        {
          label: 'O aplikacji',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'CastCast Sender',
              message: 'CatCast Sender v1.0.0',
              detail: 'Aplikacja do transmisji ekranu na telewizory LG webOS\n\nAutor: Bruno\nLicencja: MIT',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icons', 'tray-icon.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      throw new Error('Tray icon empty');
    }
  } catch {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icons', 'Icon.ico'));
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isStreaming ? '🔴 Transmisja aktywna' : '⚫ Transmisja nieaktywna',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Pokaż aplikację',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Rozpocznij transmisję',
      type: 'checkbox',
      checked: isStreaming,
      click: () => mainWindow.webContents.send('start-stream')
    },
    { type: 'separator' },
    {
      label: 'Wyjdź',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('CatCast Sender');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ipc handlers
ipcMain.handle('get-monitors', () => {
  return getMonitorsInfo();
});

ipcMain.handle('get-windows', async () => {
  return await screenCapture.getAvailableWindows();
});

ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.on('get-settings-sync', (event) => {
  event.returnValue = store.store;
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set(settings);

  // handle system autostart mechanism
  if (settings.autoStart !== undefined) {
    const isMac = process.platform === 'darwin';
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      openAsHidden: settings.minimizeToTray || false,
      args: ['--hidden']
    });
  }

  return true;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths;
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  return result.filePaths;
});

ipcMain.handle('get-local-ip', () => {
  return getLocalIP();
});

ipcMain.handle('install-update', () => {
  log.info('User requested restart for update installation.');
  autoUpdater.quitAndInstall();
});

ipcMain.handle('start-server', async (event, config) => {
  try {
    log.info('Starting streaming server with config:', config);

    config.bestEncoder = store.get('bestEncoder');

    // save config
    store.set('serverPort', config.port || 8080);
    store.set('quality', config.quality || 'medium');
    store.set('fps', config.fps || 30);

    // start server
    serverInstance = await startStreamingServer(config);
    isStreaming = true;

    // save detected hardware encoder for the first time
    serverInstance.on('encoder-determined', (encoder) => {
      store.set('bestEncoder', encoder);
    });

    serverInstance.on('stream-error', (errorMsg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-error', errorMsg);
      }
    });

    serverInstance.on('frame', (frameData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-frame', frameData);
      }
    });

    // sending native file path
    if (config.captureSource === 'file') {
      const url = `http://${getLocalIP()}:${config.port || 8080}/api/stream-file`;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('native-file-stream', url);
      }
    }

    updateTrayMenu();

    return {
      success: true,
      port: config.port || 8080,
      localIP: getLocalIP()
    };
  } catch (error) {
    log.error('Failed to start server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-qr-code', async (event, text) => {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    log.error('Failed to generate QR code:', err);
    return null;
  }
});

ipcMain.handle('stop-server', async () => {
  try {
    if (serverInstance) {
      await serverInstance.stop();
      serverInstance = null;
    }
    isStreaming = false;
    updateTrayMenu();
    return { success: true };
  } catch (error) {
    log.error('Failed to stop server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-connected-clients', () => {
  if (serverInstance) {
    return serverInstance.getConnectedClients();
  }
  return [];
});

ipcMain.handle('disconnect-client', (event, clientId) => {
  if (serverInstance) {
    return serverInstance.disconnectClient(clientId);
  }
  return false;
});

ipcMain.on('playback-control', (event, action, time, total, paused) => {
  if (serverInstance) {
    if (typeof serverInstance.handlePlaybackControl === 'function') {
      serverInstance.handlePlaybackControl(action, time, total, paused);
    } else {
      serverInstance.broadcast({
        type: 'playback_control',
        action: action,
        time: time,
        total: total,
        paused: paused,
        timestamp: Date.now()
      });
    }
  }
});

ipcMain.handle('get-audio-devices', () => {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const exe = path.join(__dirname, 'wasapi_capture.exe').replace('app.asar', 'app.asar.unpacked');

    const fs = require('fs');
    if (!fs.existsSync(exe)) {
      log.warn('wasapi_capture.exe not found for device listing');
      return resolve([]);
    }

    const child = spawn(exe, ['--list-devices']);
    let stdout = '';

    child.on('error', (err) => {
      log.error('Failed to spawn wasapi_capture:', err);
      resolve([]);
    });

    child.stdout.on('data', (data) => stdout += data);

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const devices = JSON.parse(stdout);
          resolve(devices);
        } catch (e) {
          log.error('Failed to parse device list:', e);
          resolve([]);
        }
      } else {
        log.error('Audio device list failed with code', code);
        resolve([]);
      }
    });
  });
});

ipcMain.handle('set-system-default-audio', async (event, deviceId) => {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const exe = path.join(__dirname, 'wasapi_capture.exe').replace('app.asar', 'app.asar.unpacked');

    const child = spawn(exe, ['--set-default', deviceId]);

    child.on('error', (err) => {
      log.error('Failed to spawn wasapi_capture for set-default:', err);
      resolve(false);
    });

    child.on('close', (code) => {
      if (code === 0) {
        log.info(`System default audio set to: ${deviceId}`);
        resolve(true);
      } else {
        log.error(`Failed to set default audio (code ${code})`);
        resolve(false);
      }
    });
  });
});

ipcMain.handle('get-system-default-audio', () => {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const exe = path.join(__dirname, 'wasapi_capture.exe').replace('app.asar', 'app.asar.unpacked');

    const child = spawn(exe, ['--get-default']);
    let stdout = '';

    child.on('error', (err) => {
      log.error('Failed to spawn wasapi_capture for get-default:', err);
      resolve(null);
    });

    child.stdout.on('data', (data) => stdout += data);

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
});

function updateTrayMenu() {
  if (tray) {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isStreaming ? '🔴 Transmisja aktywna' : '⚫ Transmisja nieaktywna',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Pokaż aplikację',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: isStreaming ? 'Zatrzymaj transmisję' : 'Rozpocznij transmisję',
        click: () => {
          if (isStreaming) {
            mainWindow.webContents.send('stop-stream');
          } else {
            mainWindow.webContents.send('start-stream');
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Wyjdź',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  }
}

// auto-updater events
autoUpdater.on('update-available', () => {
  log.info('Update available');
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  log.info('Update downloaded');
  mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
  log.error('Update error:', err);
});

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register(store.get('hotkeys.startStop') || 'Ctrl+Shift+S', () => {
    if (mainWindow && isStreaming) mainWindow.webContents.send('stop-stream');
    else if (mainWindow && !isStreaming) mainWindow.webContents.send('start-stream');
  });

  globalShortcut.register(store.get('hotkeys.pauseResume') || 'Ctrl+Shift+P', () => {
    if (mainWindow && isStreaming) mainWindow.webContents.send('toggle-pause');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  if (store.get('autoStart') && !isStreaming) {
    setTimeout(() => {
      mainWindow.webContents.send('auto-start');
    }, 1000);
  }

  // Hide window if running from auto-start login item with --hidden argument
  if (process.argv.includes('--hidden') && store.get('minimizeToTray')) {
    if (mainWindow) {
      mainWindow.hide();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  app.isQuiting = true;

  if (serverInstance) {
    event.preventDefault();
    try {
      await serverInstance.stop();
      serverInstance = null;
    } catch (err) {
      log.error('Error stopping server:', err);
    } finally {
      app.exit();
    }
  }
});

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('lg-cast', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('lg-cast');
}