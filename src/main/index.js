const { app, screen } = require('electron');
const { createControlWindow, createPetWindow } = require('./windows');

// Fix taskbar icon association on Windows.
// Without an AppUserModelID, Windows cannot reliably associate the window
// with an icon when launched via `npx electron .`, showing a generic icon.
app.setAppUserModelId('com.daimeow.desktop');
const { createTray } = require('./tray');
const { registerIpcHandlers } = require('./ipc-handlers');
const { load: loadConfig, getAll: getConfig } = require('./services/config-store');
const { ChatManager } = require('./services/chat-manager');
const { StatsTracker } = require('./services/stats-tracker');
const { IdleDetector } = require('./services/idle-detector');
const { MousePoller } = require('./services/mouse-poller');
const { ApiClient } = require('./services/api-client');
const { captureScreen } = require('./services/screenshot');
const { ModelServer } = require('./services/model-server');
const { PersonalityManager } = require('./services/personality-manager');
const { OllamaProvider } = require('./services/ollama-provider');
const { GamepadPoller } = require('./services/gamepad-poller');
const { NoticeManager } = require('./services/notice-manager');
const { save: saveConfig } = require('./services/config-store');

let controlWindow = null;
let petWindow = null;
let tray = null;
let isQuitting = false;

// Services
const chatManager = new ChatManager();
const statsTracker = new StatsTracker();
const modelServer = new ModelServer();
const personalityManager = new PersonalityManager();
const ollamaProvider = new OllamaProvider();
const noticeManager = new NoticeManager();
let apiClient = null;
let idleDetector = null;
let mousePoller = null;
let gamepadPoller = null;
let screenshotTimer = null;

app.whenReady().then(async () => {
  console.log('[DaiMeow] App ready');

  // Start local HTTP server for model files
  await modelServer.start();

  loadConfig();

  controlWindow = createControlWindow();
  petWindow = createPetWindow();
  tray = createTray(controlWindow, (v) => { isQuitting = v; });

  // Sync position sliders after native drag (debounced)
  let moveSaveTimer = null;
  petWindow.on('move', () => {
    // 程序化调整（setSize/setPosition）产生的 move 事件在时间戳窗口内直接忽略
    if (petWindow._skipMoveUntil && Date.now() < petWindow._skipMoveUntil) return;
    if (moveSaveTimer) clearTimeout(moveSaveTimer);
    moveSaveTimer = setTimeout(() => {
      if (petWindow.isDestroyed()) return;
      const { width: screenW, height: screenH } = screen.getPrimaryDisplay().bounds;
      const bounds = petWindow.getBounds();
      const x = screenW > bounds.width ? bounds.x / (screenW - bounds.width) : 0;
      const y = screenH > bounds.height ? bounds.y / (screenH - bounds.height) : 0;
      saveConfig({ petPositionX: Math.max(0, Math.min(1, x)), petPositionY: Math.max(0, Math.min(1, y)) });
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('main:position-sync', {
          x: Math.round(Math.max(0, Math.min(1, x)) * 100),
          y: Math.round(Math.max(0, Math.min(1, y)) * 100),
        });
      }
    }, 300);
  });

  apiClient = new ApiClient(
    { getAll: getConfig },
    chatManager,
    statsTracker,
    personalityManager,
    ollamaProvider
  );

  registerIpcHandlers({
    getPetWindow: () => petWindow,
    getChatManager: () => chatManager,
    getModelServer: () => modelServer,
    getPersonalityManager: () => personalityManager,
    getOllamaProvider: () => ollamaProvider,
    getNoticeManager: () => noticeManager,
    startMousePoller: () => {
      if (!mousePoller) {
        mousePoller = new MousePoller(petWindow, { intervalMs: 50 });
        mousePoller.start();
      }
      if (!gamepadPoller) {
        gamepadPoller = new GamepadPoller(petWindow);
        gamepadPoller.start();
      }
    },
    startLoop,
    stopLoop,
  });

  controlWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      controlWindow.hide();
    }
  });

  // 后台异步检查远程公告，不阻塞启动；失败静默
  noticeManager.check().then((notice) => {
    if (notice && controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('main:show-notice', notice);
    }
  });
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  isQuitting = true;
  stopLoop();
  chatManager.clear();
  if (mousePoller) { mousePoller.stop(); }
  if (gamepadPoller) { gamepadPoller.stop(); }
  modelServer.stop();
});
app.on('activate', () => {
  if (controlWindow) {
    controlWindow.show();
    controlWindow.focus();
  }
});

function startLoop() {
  const config = getConfig();

  // Defensive: clear any existing loop to avoid duplicate timers
  stopLoop();

  idleDetector = new IdleDetector({
    threshold: 60,
    onIdleChange: (idle) => {
      statsTracker.setIdle(idle);
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('main:status-change', idle ? 'idle' : 'running');
      }
    },
  });
  idleDetector.start();

  statsTracker.start();

  const intervalMs = config.screenshotInterval * 1000;
  runCycle();
  screenshotTimer = setInterval(runCycle, intervalMs);

  const statsTimer = setInterval(() => {
    if (statsTracker.status === 'running') statsTracker.addUptime(1);
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('main:stats-update', statsTracker.getStats());
    }
  }, 1000);

  // 统计累计值每 30 秒落盘一次（避免每秒同步写磁盘）
  const flushTimer = setInterval(() => statsTracker.flush(), 30000);

  screenshotTimer._statsTimer = statsTimer;
  screenshotTimer._flushTimer = flushTimer;
}

function stopLoop() {
  if (idleDetector) { idleDetector.stop(); idleDetector = null; }
  if (screenshotTimer) {
    clearInterval(screenshotTimer._statsTimer);
    clearInterval(screenshotTimer._flushTimer);
    clearInterval(screenshotTimer);
    screenshotTimer = null;
  }
  statsTracker.flush();
  statsTracker.stop();
  // 停止循环时一并停掉鼠标/手柄轮询，避免隐藏窗口后空转
  if (mousePoller) { mousePoller.stop(); mousePoller = null; }
  if (gamepadPoller) { gamepadPoller.stop(); gamepadPoller = null; }
}

let cycleRunning = false;

async function runCycle() {
  if (cycleRunning) return;
  if (idleDetector && idleDetector.isIdle) return;

  cycleRunning = true;
  try {
    const base64Image = await captureScreen();
    const reply = await apiClient.sendScreenshot(base64Image);

    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('main:new-response', {
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      });
    }

    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('pet:show-speech', reply);
    }
  } catch (err) {
    console.error('Cycle error:', err.message);
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('main:error', {
        code: 'API_ERROR',
        message: err.message,
        timestamp: Date.now(),
      });
    }
  } finally {
    cycleRunning = false;
  }
}
