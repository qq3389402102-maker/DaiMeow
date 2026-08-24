const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULTS = {
  apiKey: '',
  apiKeys: {},
  provider: 'custom',
  apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
  model: '',
  providerType: 'api',
  ollamaEndpoint: 'http://127.0.0.1:11434',
  screenshotInterval: 5,
  maxTokens: 60,
  temperature: 0.6,
  petScale: 0.5,
  petPositionX: 0,
  petPositionY: 0.5,
  fixedPosition: false,
  mousePassthrough: false,
  petOpacity: 1.0,
  alwaysOnTop: true,
  winBounds: null,
  firstRunComplete: false,
  lastNotice: '',
};

let config = { ...DEFAULTS };

function load() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const saved = JSON.parse(data);
      config = { ...DEFAULTS, ...saved };
    }
  } catch (err) {
    console.error('Failed to load config:', err.message);
    config = { ...DEFAULTS };
  }
}

function save(partial) {
  Object.assign(config, partial);
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config:', err.message);
  }
}

function getAll() {
  return { ...config };
}

module.exports = { load, save, getAll, DEFAULTS };
