const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  // Get model URL from main process (resolves path safely)
  getModelUrl: (filename) => {
    return ipcRenderer.sendSync('pet:get-model-url', filename);
  },

  onMousePosition: (callback) => {
    ipcRenderer.on('pet:mouse-pos', (event, pos) => callback(pos));
  },
  onGamepadPosition: (callback) => {
    ipcRenderer.on('pet:gamepad-pos', (event, pos) => callback(pos));
  },
  onShowSpeech: (callback) => {
    ipcRenderer.on('pet:show-speech', (event, text) => callback(text));
  },
  onHideSpeech: (callback) => {
    ipcRenderer.on('pet:hide-speech', () => callback());
  },
  onResize: (callback) => {
    ipcRenderer.on('pet:resize', (event, size) => callback(size));
  },

  onPassthroughChanged: (callback) => {
    ipcRenderer.on('pet:passthrough-changed', (event, enabled) => callback(enabled));
  },
  onFixedChanged: (callback) => {
    ipcRenderer.on('pet:fixed-changed', (event, enabled) => callback(enabled));
  },

  notifyReady: (width, height) => {
    ipcRenderer.invoke('pet:ready', { width, height });
  },
  logError: (msg) => {
    ipcRenderer.invoke('pet:log-error', msg);
  },
});
