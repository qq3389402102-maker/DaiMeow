// DaiMeow Pet Renderer
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';

const petAPI = window.petAPI;
const canvas = document.getElementById('petCanvas');
const speechBubble = document.getElementById('speech-bubble');
let speechTimer = null;
const MODEL_PATH = petAPI.getModelUrl('daimeow.model3.json');

const app = new PIXI.Application({
  view: canvas, width: window.innerWidth, height: window.innerHeight,
  transparent: true, backgroundAlpha: 0, antialias: true,
  resolution: window.devicePixelRatio || 1, autoDensity: true,
});

Live2DModel.registerTicker(PIXI.Ticker);
let live2dModel = null;
let nativeW = 0, nativeH = 0;

// --- Mouse / Gamepad state ---
let targetX = 0, targetY = 0;
let currentX = 0, currentY = 0;
let gamepadTimeout = 0;

// --- Layout state (lerped for smooth transitions) ---
let targetScale = 0, currentScale = 0;
let targetCX = 0, targetCY = 0;
let currentCX = 0, currentCY = 0;

// --- Passthrough / Fixed state ---
let isPassthrough = true;
let isFixed = false;

// --- Load model ---
async function loadModel() {
  try {
    live2dModel = await Live2DModel.from(MODEL_PATH, { autoInteract: false });
    nativeW = live2dModel.width;
    nativeH = live2dModel.height;
    live2dModel.anchor.set(0.5, 0.5);
    app.stage.addChild(live2dModel);
    applyLayout(true); // snap on load
    petAPI.notifyReady(app.screen.width, app.screen.height);
  } catch (err) {
    console.error('Model load failed:', err);
    document.body.insertAdjacentHTML('beforeend',
      '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:80px;pointer-events:none;position:fixed;top:0;left:0">🐱</div>');
    petAPI.notifyReady(window.innerWidth, window.innerHeight);
  }
}

// --- Layout: compute target scale/position from screen size ---
// snap=true: apply instantly (used on model load)
// snap=false: set targets for smooth lerp in ticker (used on resize)
function applyLayout(snap) {
  if (!live2dModel || nativeW === 0) return;
  const w = app.screen.width;
  const h = app.screen.height;
  if (w === 0 || h === 0) return;
  targetScale = Math.min(w / nativeW, h / nativeH);
  targetCX = w / 2;
  targetCY = h / 2;
  if (snap) {
    currentScale = targetScale;
    currentCX = targetCX;
    currentCY = targetCY;
    live2dModel.scale.set(currentScale);
    live2dModel.x = currentCX;
    live2dModel.y = currentCY;
  }
}

// --- IPC handlers ---
petAPI.onMousePosition((pos) => {
  if (Date.now() < gamepadTimeout) return;
  targetX = pos.relX;
  targetY = -pos.relY;
});
petAPI.onGamepadPosition((pos) => {
  targetX = pos.relX;
  targetY = pos.relY;
  gamepadTimeout = Date.now() + 500;
});

// 气泡每行显示的字数
const CHARS_PER_LINE = 7;
// 字号 13px，中文字宽按 ~15px 保守估算（含字体间距），加左右 padding 32px
const BUBBLE_MAX_W = Math.round(CHARS_PER_LINE * 15 + 32);

petAPI.onShowSpeech((text) => {
  speechBubble.textContent = text;
  speechBubble.style.maxWidth = BUBBLE_MAX_W + 'px';
  speechBubble.classList.add('show');
  if (speechTimer) clearTimeout(speechTimer);
  speechTimer = setTimeout(() => speechBubble.classList.remove('show'), 6000);
});
petAPI.onHideSpeech(() => speechBubble.classList.remove('show'));

petAPI.onResize((size) => {
  app.renderer.resize(size.w, size.h);
  applyLayout(false); // smooth transition
});
window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  applyLayout(false); // smooth transition
});

// --- Passthrough & fixed config ---
// Controls -webkit-app-region for native OS-level window drag.
// When passthrough=OFF & fixed=OFF → draggable; otherwise → not draggable.
function updateDragRegion() {
  document.body.style.webkitAppRegion = (isPassthrough || isFixed) ? 'no-drag' : 'drag';
}

petAPI.onPassthroughChanged((enabled) => {
  isPassthrough = enabled;
  updateDragRegion();
});
petAPI.onFixedChanged((enabled) => {
  isFixed = enabled;
  updateDragRegion();
});

// --- Animation loop ---
const MOUSE_SMOOTH = 0.12;
const LAYOUT_SMOOTH = 0.08;

app.ticker.add(() => {
  if (!live2dModel) return;

  // Head tracking
  currentX += (targetX - currentX) * MOUSE_SMOOTH;
  currentY += (targetY - currentY) * MOUSE_SMOOTH;
  live2dModel.internalModel.focusController.x = currentX;
  live2dModel.internalModel.focusController.y = currentY;

  // Layout lerp (scale + position)
  currentScale += (targetScale - currentScale) * LAYOUT_SMOOTH;
  currentCX += (targetCX - currentCX) * LAYOUT_SMOOTH;
  currentCY += (targetCY - currentCY) * LAYOUT_SMOOTH;
  live2dModel.scale.set(currentScale);
  live2dModel.x = currentCX;
  live2dModel.y = currentCY;

  // Speech bubble — positioned above model head, clamped within window
  const winW = app.screen.width;
  const winH = app.screen.height;
  const pad = 6;

  // 每行显示 ~7 个中文字（宽度由 CSS 用 em 控制，中文字宽≈1em）
  const bubbleW = speechBubble.offsetWidth || 140;
  const bubbleH = speechBubble.offsetHeight || 0;

  const headTop = currentCY - (nativeH * currentScale) / 2;
  const bubbleTop = headTop - bubbleH - pad;

  // Horizontal: center over model, clamped to window
  const leftMin = bubbleW / 2 + pad;
  const leftMax = winW - bubbleW / 2 - pad;
  const bubbleLeft = Math.max(leftMin, Math.min(currentCX, leftMax));

  // Vertical: above head, clamped
  const topClamped = Math.max(pad, bubbleTop);

  speechBubble.style.left = bubbleLeft + 'px';
  speechBubble.style.top = topClamped + 'px';
});

loadModel();
