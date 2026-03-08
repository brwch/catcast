const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // monitors
  getMonitors: () => ipcRenderer.invoke('get-monitors'),
  getWindows: () => ipcRenderer.invoke('get-windows'),
  generateQRCode: (text) => ipcRenderer.invoke('generate-qr-code', text),

  // settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getSettingsSync: () => ipcRenderer.sendSync('get-settings-sync'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // server
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  startServer: (config) => ipcRenderer.invoke('start-server', config),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  getConnectedClients: () => ipcRenderer.invoke('get-connected-clients'),
  disconnectClient: (clientId) => ipcRenderer.invoke('disconnect-client', clientId),

  // audio device management
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  setSystemDefaultAudio: (deviceId) => ipcRenderer.invoke('set-system-default-audio', deviceId),
  getSystemDefaultAudio: () => ipcRenderer.invoke('get-system-default-audio'),

  // files
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // events
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onSelectFile: (callback) => ipcRenderer.on('select-file', callback),
  onStreamFrame: (callback) => ipcRenderer.on('stream-frame', callback),
  onNativeFileStream: (callback) => ipcRenderer.on('native-file-stream', callback),
  onStartStream: (callback) => ipcRenderer.on('start-stream', callback),
  onStopStream: (callback) => ipcRenderer.on('stop-stream', callback),
  onTogglePause: (callback) => ipcRenderer.on('toggle-pause', callback),
  onAutoStart: (callback) => ipcRenderer.on('auto-start', callback),
  onStreamError: (callback) => ipcRenderer.on('stream-error', callback),

  playbackControl: (action, time, total, paused) => ipcRenderer.send('playback-control', action, time, total, paused),

  // application
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // logs
  log: (level, message) => ipcRenderer.send('log', level, message)
});