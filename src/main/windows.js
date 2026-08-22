const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { PET_BASE_W, PET_BASE_H } = require('./services/pet-dimensions');

function createControlWindow() {
  const config = require('./services/config-store').getAll();
  const saved = config.winBounds;

  const win = new BrowserWindow({
    width: (saved && saved.width) || 900,
    height: (saved && saved.height) || 600,
    minWidth: 840,
    minHeight: 630,
    resizable: true,
    title: '呆喵 DaiMeow',
    icon: path.join(__dirname, '..', 'renderer', 'control', 'logo.ico'),
    backgroundColor: '#f0f7ff',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'control-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Save bounds on resize/move
  const { save } = require('./services/config-store');
  const saveBounds = () => {
    if (!win.isDestroyed() && !win.isMinimized()) {
      const { width, height } = win.getBounds();
      save({ winBounds: { width, height } });
    }
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('close', saveBounds);

  win.loadFile(path.join(__dirname, '..', 'renderer', 'control', 'index.html'));
  win.setMenuBarVisibility(false);
  return win;
}

function createPetWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().bounds;
  const config = require('./services/config-store').getAll();
  const scale = config.petScale ?? 0.5;
  const petW = Math.round(PET_BASE_W * scale);
  const petH = Math.round(PET_BASE_H * scale);

  const win = new BrowserWindow({
    width: petW,
    height: petH,
    x: Math.round((screenW - petW) * (config.petPositionX ?? 0.05)),
    y: Math.round((screenH - petH) * (config.petPositionY ?? 0.5)),
    transparent: true,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'pet-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));
  win.setAlwaysOnTop(true, 'screen-saver');
  // Apply saved passthrough & opacity settings
  win.setIgnoreMouseEvents(config.mousePassthrough ?? true);
  if ((config.petOpacity ?? 1.0) < 1.0) {
    win.setOpacity(config.petOpacity);
  }

  return win;
}

module.exports = { createControlWindow, createPetWindow };
