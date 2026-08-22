const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

const ICON_PATH = path.join(__dirname, '..', 'renderer', 'control', 'logo.ico');

function createTray(controlWindow, setIsQuitting) {
  // Resize to 32x32 for sharp tray display on Windows
  const rawIcon = nativeImage.createFromPath(ICON_PATH);
  const trayIcon = rawIcon.resize({ width: 32, height: 32 });
  const tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        controlWindow.show();
        controlWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出呆喵',
      click: () => {
        setIsQuitting(true);
        const { app } = require('electron');
        app.quit();
      },
    },
  ]);

  tray.setToolTip('呆喵');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    controlWindow.show();
    controlWindow.focus();
  });

  return tray;
}

module.exports = { createTray };
