const { ipcMain, screen } = require('electron');
const { save: saveConfig, getAll: getConfig } = require('./services/config-store');
const { PET_BASE_W, PET_BASE_H } = require('./services/pet-dimensions');

function registerIpcHandlers(ctx) {
  // Model file URL resolver (sync, used by preload)
  ipcMain.on('pet:get-model-url', (event, filename) => {
    const baseUrl = ctx.getModelServer().getBaseUrl();
    event.returnValue = baseUrl + '/daimeow/' + filename;
  });

  // Config
  ipcMain.handle('control:get-config', async () => {
    return getConfig();
  });

  ipcMain.handle('control:save-config', async (event, partial) => {
    saveConfig(partial);
    return getConfig();
  });

  // Chat history
  ipcMain.handle('control:get-chat-history', async () => {
    return ctx.getChatManager().getTextOnlyHistory();
  });

  // Start / Stop
  ipcMain.handle('control:start', async () => {
    const petWindow = ctx.getPetWindow();
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show();
      const config = getConfig();
      petWindow.webContents.send('pet:passthrough-changed', config.mousePassthrough ?? true);
      petWindow.webContents.send('pet:fixed-changed', config.fixedPosition ?? false);
      // 重启时确保鼠标/手柄轮询恢复（stopLoop 已将其停止）
      ctx.startMousePoller();
    }
    ctx.startLoop();
    return true;
  });

  ipcMain.handle('control:stop', async () => {
    ctx.stopLoop();
    const petWindow = ctx.getPetWindow();
    if (petWindow && !petWindow.isDestroyed()) petWindow.hide();
    return true;
  });

  // Pet ready — start mouse tracking
  ipcMain.handle('pet:ready', async () => {
    ctx.startMousePoller();
    return true;
  });

  // Pet error log
  ipcMain.handle('pet:log-error', async (event, msg) => {
    console.error('[Pet Error]', msg);
    return true;
  });

  // Pet position/size from edit panel
  ipcMain.handle('control:update-pet-position', async (event, { x, y, scale }) => {
    const petWindow = ctx.getPetWindow();
    if (!petWindow || petWindow.isDestroyed()) return false;

    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().bounds;
    const petW = Math.round(PET_BASE_W * scale);
    const petH = Math.round(PET_BASE_H * scale);
    const posX = Math.round((screenW - petW) * x);
    const posY = Math.round((screenH - petH) * y);

    // 程序化调整期间抑制 move 事件保存位置（Electron 的 move 事件异步派发，
    // 用时间戳窗口而不是同步标志位，避免竞态）
    petWindow._skipMoveUntil = Date.now() + 300;
    petWindow.setSize(petW, petH);
    petWindow.setPosition(posX, posY);
    petWindow.webContents.send('pet:resize', { w: petW, h: petH });

    saveConfig({ petPositionX: x, petPositionY: y, petScale: scale });
    return true;
  });

  // Reset edit panel defaults
  ipcMain.handle('control:reset-pet-defaults', async () => {
    saveConfig({ petPositionX: 0, petPositionY: 0.5, petScale: 0.5 });

    const petWindow = ctx.getPetWindow();
    if (petWindow && !petWindow.isDestroyed()) {
      const { width: screenW, height: screenH } = screen.getPrimaryDisplay().bounds;
      const petW = Math.round(PET_BASE_W * 0.5);
      const petH = Math.round(PET_BASE_H * 0.5);
      petWindow._skipMoveUntil = Date.now() + 300;
      petWindow.setSize(petW, petH);
      petWindow.setPosition(Math.round((screenW - petW) * 0), Math.round((screenH - petH) * 0.5));
      petWindow.webContents.send('pet:resize', { w: petW, h: petH });
    }
    return true;
  });

  // Personality system
  ipcMain.handle('personality:get-all', async () => {
    return ctx.getPersonalityManager().getAll();
  });
  ipcMain.handle('personality:get-current', async () => {
    return ctx.getPersonalityManager().getCurrent();
  });
  ipcMain.handle('personality:set-current', async (event, id) => {
    return ctx.getPersonalityManager().setCurrent(id);
  });
  ipcMain.handle('personality:preview', async (event, id) => {
    return ctx.getPersonalityManager().getPreview(id);
  });

  // Ollama
  ipcMain.handle('ollama:fetch-models', async (event, endpoint) => {
    return ctx.getOllamaProvider().fetchModels(endpoint);
  });

  // Fixed position toggle
  ipcMain.handle('control:set-fixed-position', async (event, enabled) => {
    saveConfig({ fixedPosition: enabled });
    const petWindow = ctx.getPetWindow();
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('pet:fixed-changed', enabled);
    }
    return true;
  });

  // Mouse passthrough toggle
  ipcMain.handle('control:set-passthrough', async (event, enabled) => {
    saveConfig({ mousePassthrough: enabled });
    const petWindow = ctx.getPetWindow();
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setIgnoreMouseEvents(enabled);
      petWindow.webContents.send('pet:passthrough-changed', enabled);
    }
    return true;
  });

  // Opacity slider
  ipcMain.handle('control:set-opacity', async (event, value) => {
    saveConfig({ petOpacity: value });
    const petWindow = ctx.getPetWindow();
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setOpacity(value);
    }
    return true;
  });

  // 公告已读标记（渲染进程实际显示后调用）
  ipcMain.handle('notice:dismiss', async (event, version) => {
    ctx.getNoticeManager().markSeen(version);
    return true;
  });

}

module.exports = { registerIpcHandlers };
