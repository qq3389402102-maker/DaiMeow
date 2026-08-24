// === DaiMeow Control Panel ===
const api = window.daimeowAPI;
let isRunning = false;

// --- Tab switching ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${tab}`));

  if (tab === 'history') refreshHistory();
  if (tab === 'config') loadConfigToForm();
  if (tab === 'personality') loadPersonalities();
}

// --- Start/Stop ---
const startBtn = document.getElementById('startBtn');

startBtn.addEventListener('click', async () => {
  if (!isRunning) {
    startBtn.textContent = '启动中...';
    startBtn.disabled = true;
    try {
      await api.invoke('control:start');
      isRunning = true;
      startBtn.textContent = '停止运行';
      startBtn.classList.add('running');
      startBtn.disabled = false;
      updateStatus('运行中');
    } catch (err) {
      startBtn.textContent = '呆喵？启动！';
      startBtn.disabled = false;
      showError('启动失败: ' + err.message);
    }
  } else {
    await api.invoke('control:stop');
    isRunning = false;
    startBtn.textContent = '呆喵？启动！';
    startBtn.classList.remove('running');
    updateStatus('已停止');
  }
});

function updateStatus(text) {
  const ms = document.getElementById('mainStatus');
  if (text === '运行中') ms.textContent = '呆喵正陪着老大喵~';
  else if (text === '闲置中') ms.textContent = '呆喵在等你回来..';
  else ms.textContent = '呆喵准备就绪，喵！';
}

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// --- Stats update listener ---
api.on('main:stats-update', (stats) => {
  document.getElementById('statMessages').textContent = stats.messages;
  document.getElementById('statTokens').textContent = stats.tokens;
  document.getElementById('statMiniTotalMessages').textContent = stats.totalMessages ?? 0;
  document.getElementById('statMiniTotalTokens').textContent = stats.totalTokensAll ?? 0;
  document.getElementById('statMiniTotalUptime').textContent = formatUptime(stats.totalUptime ?? 0);
  // Avg tokens per request
  const total = stats.totalMessages || 1;
  document.getElementById('statMiniAvgTokens').textContent = '~' + Math.round((stats.totalTokensAll || 0) / total);
  document.getElementById('statUptime').textContent = formatUptime(stats.uptime);
});

// --- Status changes ---
api.on('main:status-change', (status) => {
  if (status === 'idle') updateStatus('闲置中');
  else if (status === 'running') updateStatus('运行中');
  else updateStatus('已停止');
});

// --- New AI response ---
api.on('main:new-response', (msg) => {
  addHistoryMessage(msg);
  // 对话总数由 main:stats-update 统一更新，避免双通道竞争
});

// --- Error handling ---
api.on('main:error', (err) => {
  showError(err.message);
});

function showError(msg) {
  showToast('错误: ' + msg);
}

// --- Config Panel ---
const PROVIDER_ENDPOINTS = {
  custom: '',
  moonshot: 'https://api.moonshot.cn/v1/chat/completions',
  volcano: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  mimo: 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions',
  other: '',
};

const PROVIDER_MODELS = {
  custom: [],
  moonshot: [
    { name: 'Kimi K3', id: 'kimi-k3', inputPrice: '? 元/M tokens', outputPrice: '? 元/M tokens', cheap: false },
    { name: 'Kimi K2.6', id: 'kimi-k2.6', inputPrice: '0.60 元/M tokens', outputPrice: '0.60 元/M tokens', cheap: true },
  ],
  volcano: [
    { name: '豆包 Seed 2.0 Lite', id: 'doubao-seed-2-0-lite-260215', inputPrice: '? 元/M tokens', outputPrice: '? 元/M tokens', cheap: false },
    { name: '豆包视觉 Lite', id: 'doubao-vision-lite-32k', inputPrice: '0.80 元/M tokens', outputPrice: '0.80 元/M tokens', cheap: true },
    { name: '豆包视觉 Pro', id: 'doubao-vision-pro-32k', inputPrice: '3.00 元/M tokens', outputPrice: '3.00 元/M tokens', cheap: false },
  ],
  alibaba: [
    { name: 'Qwen3-VL-Flash', id: 'qwen3-vl-flash', inputPrice: '0.15 元/M tokens', outputPrice: '1.50 元/M tokens', cheap: true },
    { name: 'Qwen2-VL-Plus', id: 'qwen-vl-plus', inputPrice: '0.80 元/M tokens', outputPrice: '2.00 元/M tokens', cheap: false },
    { name: 'Qwen2-VL-Max', id: 'qwen-vl-max', inputPrice: '3.00 元/M tokens', outputPrice: '12.00 元/M tokens', cheap: false },
  ],
  zhipu: [
    { name: 'GLM-4V-Plus', id: 'glm-4v-plus', inputPrice: '50.00 元/M tokens', outputPrice: '50.00 元/M tokens', cheap: false },
    { name: 'GLM-4V', id: 'glm-4v', inputPrice: '5.00 元/M tokens', outputPrice: '5.00 元/M tokens', cheap: true },
  ],
  siliconflow: [
    { name: 'Qwen3-VL-8B', id: 'Qwen/Qwen3-VL-8B-Instruct', inputPrice: '0.50 元/M tokens', outputPrice: '2.00 元/M tokens', cheap: true },
    { name: 'InternVL2-8B', id: 'OpenGVLab/InternVL2-8B', inputPrice: '0.50 元/M tokens', outputPrice: '0.50 元/M tokens', cheap: false },
    { name: 'Qwen2-VL-72B', id: 'Qwen/Qwen2-VL-72B-Instruct', inputPrice: '4.00 元/M tokens', outputPrice: '4.00 元/M tokens', cheap: false },
  ],
  deepseek: [
    { name: 'DeepSeek V4-Flash-Vision', id: 'deepseek-v4-flash-vision-exp', inputPrice: '1.50 元/M tokens', outputPrice: '4.50 元/M tokens', cheap: true },
  ],
  mimo: [
    { name: 'MiMo V2.5', id: 'MiMo-V2.5', inputPrice: '? 元/M tokens', outputPrice: '? 元/M tokens', cheap: true },
  ],
  other: [],
};

const cfgProvider = document.getElementById('cfgProvider');
const cfgModel = document.getElementById('cfgModel');
const cfgEndpoint = document.getElementById('cfgEndpoint');
const cfgInterval = document.getElementById('cfgInterval');
const cfgIntervalVal = document.getElementById('cfgIntervalVal');
const cfgProviderType = document.getElementById('cfgProviderType');
const cfgOllamaEndpoint = document.getElementById('cfgOllamaEndpoint');
const refreshOllamaBtn = document.getElementById('refreshOllamaBtn');
function populateModels(provider, currentModel) {
  const container = document.getElementById('cfgModelList');
  const models = PROVIDER_MODELS[provider] || [];

  // 无预设模型的 provider（custom / other）→ 直接显示自定义输入框
  if (models.length === 0) {
    container.innerHTML = `
      <div class="custom-model-box show">
        <input type="text" id="cfgCustomModel" class="input" placeholder="手动输入模型 ID" value="${currentModel || ''}">
      </div>`;
    document.getElementById('cfgModel').value = currentModel || '';
    const input = document.getElementById('cfgCustomModel');
    input.addEventListener('input', () => {
      document.getElementById('cfgModel').value = input.value;
    });
    return;
  }

  // 当前模型是否为自定义（不在预设列表中）
  const isCustom = currentModel && !models.find(m => m.id === currentModel);

  // 无任何选择时自动选最便宜的
  if (!currentModel) {
    const cheap = models.find(m => m.cheap);
    currentModel = cheap ? cheap.id : models[0].id;
  }
  document.getElementById('cfgModel').value = currentModel || '';

  container.innerHTML = models.map(m => `
    <div class="model-card${m.id === currentModel ? ' selected' : ''}" data-model="${m.id}">
      <div class="model-radio${m.id === currentModel ? ' checked' : ''}"></div>
      <div class="model-info">
        <div class="model-name">${m.name}</div>
        <div class="model-id">${m.id}</div>
      </div>
      ${m.cheap ? '<span class="model-tag">最便宜</span>' : ''}
      <div class="model-tooltip-trigger" data-tip="${m.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div class="model-tooltip" id="tip-${m.id}">
          <div class="tooltip-row"><strong>${m.name}</strong></div>
          <div class="tooltip-row"><span>模型ID:</span> ${m.id}</div>
          <div class="tooltip-row"><span>输入价格:</span> ${m.inputPrice}</div>
          <div class="tooltip-row"><span>输出价格:</span> ${m.outputPrice}</div>
        </div>
      </div>
    </div>
  `).join('') + `
    <div class="model-card custom-model-card${isCustom ? ' selected' : ''}" data-model="__custom__">
      <div class="model-radio${isCustom ? ' checked' : ''}"></div>
      <div class="model-info">
        <div class="model-name">自定义模型</div>
        <div class="model-id">手动输入模型 ID</div>
      </div>
    </div>
    <div class="custom-model-box${isCustom ? ' show' : ''}" id="cfgCustomBox">
      <input type="text" id="cfgCustomModel" class="input" placeholder="输入模型 ID" value="${isCustom ? currentModel : ''}">
    </div>`;

  // 点击选择（复用公共绑定函数）
  bindModelCardSelection(container, (card) => {
    const box = document.getElementById('cfgCustomBox');
    if (card.dataset.model === '__custom__') {
      document.getElementById('cfgModel').value = document.getElementById('cfgCustomModel').value;
      box.classList.add('show');
    } else {
      document.getElementById('cfgModel').value = card.dataset.model;
      box.classList.remove('show');
    }
  });

  // 自定义输入框实时更新 cfgModel
  const customInput = document.getElementById('cfgCustomModel');
  if (customInput) {
    customInput.addEventListener('input', () => {
      document.getElementById('cfgModel').value = customInput.value;
    });
  }
}

// 通用：为模型卡片容器绑定点击选中逻辑
function bindModelCardSelection(container, onSelect) {
  container.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
      container.querySelectorAll('.model-radio').forEach(r => r.classList.remove('checked'));
      card.classList.add('selected');
      card.querySelector('.model-radio').classList.add('checked');
      onSelect(card);
    });
  });
}

cfgProvider.addEventListener('change', () => {
  const url = PROVIDER_ENDPOINTS[cfgProvider.value];
  if (cfgProvider.value === 'other') {
    cfgEndpoint.value = '';
    populateModels('other', null);
  } else if (url) {
    cfgEndpoint.value = url;
    populateModels(cfgProvider.value, null);
  } else {
    populateModels(cfgProvider.value, null);
  }
  // 切换到该供应商时，加载它自己保存的 API Key
  loadApiKeyForProvider(cfgProvider.value);
});

// --- Provider type toggle ---
cfgProviderType.addEventListener('change', () => {
  const isOllama = cfgProviderType.value === 'ollama';
  document.querySelectorAll('.api-only').forEach(el => el.style.display = isOllama ? 'none' : '');
  document.querySelectorAll('.ollama-only').forEach(el => el.style.display = isOllama ? '' : 'none');
  if (isOllama) {
    refreshOllamaModels();
  } else {
    cfgProvider.dispatchEvent(new Event('change'));
  }
});

// --- Ollama model loading ---
async function refreshOllamaModels() {
  const container = document.getElementById('cfgModelList');
  const endpoint = cfgOllamaEndpoint.value || 'http://127.0.0.1:11434';
  container.innerHTML = '<div class="model-empty">正在读取本地模型...</div>';

  try {
    const models = await api.invoke('ollama:fetch-models', endpoint);
    if (!models || models.length === 0) {
      container.innerHTML = '<div class="model-empty">未找到模型，请确认 Ollama 已启动并安装了模型</div>';
      return;
    }
    const currentModel = cfgModel.value;
    // Auto-select first if none selected
    if (!models.find(m => m.name === currentModel)) {
      cfgModel.value = models[0].name;
    }

    container.innerHTML = models.map(m => `
      <div class="model-card${m.name === currentModel ? ' selected' : ''}" data-model="${m.name}">
        <div class="model-radio${m.name === currentModel ? ' checked' : ''}"></div>
        <div class="model-info">
          <div class="model-name">${m.name}</div>
          <div class="model-id">${m.sizeStr || ''}</div>
        </div>
        <span class="model-tag" style="color:var(--success);background:rgba(34,197,94,0.1);">本地</span>
      </div>
    `).join('');

    // Click to select
    bindModelCardSelection(container, (card) => {
      cfgModel.value = card.dataset.model;
    });
  } catch (err) {
    container.innerHTML = `<div class="model-empty">读取失败: ${err.message}</div>`;
  }
}

// Refresh button
refreshOllamaBtn.addEventListener('click', refreshOllamaModels);

cfgInterval.addEventListener('input', () => {
  cfgIntervalVal.textContent = cfgInterval.value + 's';
});

let savedProvider = 'custom';
let currentConfig = null;

// 按供应商加载对应 API Key 到输入框（只显示该供应商自己保存的 key，无则留空）
function loadApiKeyForProvider(providerId) {
  const key = currentConfig?.apiKeys?.[providerId] ?? '';
  document.getElementById('cfgApiKey').value = key;
}

async function loadConfigToForm() {
  const config = await api.invoke('control:get-config');
  if (!config) return;
  currentConfig = config;

  // Provider type
  const isOllama = config.providerType === 'ollama';
  cfgProviderType.value = isOllama ? 'ollama' : 'api';
  document.getElementById('cfgMaxTokens').value = config.maxTokens || 300;
  document.getElementById('cfgTemperature').value = config.temperature ?? 0.6;
  cfgEndpoint.value = isOllama ? (config.ollamaEndpoint || 'http://127.0.0.1:11434') : (config.apiEndpoint || '');
  cfgOllamaEndpoint.value = config.ollamaEndpoint || 'http://127.0.0.1:11434';
  cfgInterval.value = config.screenshotInterval || 5;
  cfgIntervalVal.textContent = (config.screenshotInterval || 5) + 's';

  // Toggle visibility
  document.querySelectorAll('.api-only').forEach(el => el.style.display = isOllama ? 'none' : '');
  document.querySelectorAll('.ollama-only').forEach(el => el.style.display = isOllama ? '' : 'none');
  if (isOllama) {
    setTimeout(() => refreshOllamaModels(), 300);
  } else {
    // 优先用保存的 provider，其次从 endpoint 反推
    savedProvider = config.provider || 'custom';
    if (!PROVIDER_ENDPOINTS[savedProvider]) {
      savedProvider = 'custom';
      for (const [key, url] of Object.entries(PROVIDER_ENDPOINTS)) {
        if (url && config.apiEndpoint === url) { savedProvider = key; break; }
      }
    }
    cfgProvider.value = savedProvider;
    populateModels(savedProvider, config.model || '');
    // 迁移旧版单 key 到当前供应商槽位（避免升级后输入框为空但 key 丢失）
    if (config.apiKey && (!config.apiKeys || Object.keys(config.apiKeys).length === 0)) {
      currentConfig.apiKeys = { [savedProvider]: config.apiKey };
      api.invoke('control:save-config', { apiKeys: currentConfig.apiKeys });
    }
    loadApiKeyForProvider(savedProvider);
  }

  // Edit panel
  document.getElementById('editPosX').value = Math.round((config.petPositionX ?? 0) * 100);
  document.getElementById('editPosXVal').textContent = Math.round((config.petPositionX ?? 0) * 100) + '%';
  document.getElementById('editPosY').value = Math.round((config.petPositionY ?? 0.5) * 100);
  document.getElementById('editPosYVal').textContent = Math.round((config.petPositionY ?? 0.5) * 100) + '%';
  // 显示值 = 实际缩放 × 2（例如实际 0.5x 显示为 1.0x，实际 0.25x 显示为 0.5x）
  const scale = Math.round(((config.petScale ?? 0.5) / 0.5) * 100);
  document.getElementById('editScale').value = scale;
  document.getElementById('editScaleVal').textContent = (scale / 100).toFixed(1) + 'x';

  // New controls
  document.getElementById('editFixedPosition').checked = config.fixedPosition || false;
  document.getElementById('editMousePassthrough').checked = config.mousePassthrough ?? false;
  document.getElementById('editAlwaysOnTop').checked = config.alwaysOnTop ?? true;
  const opacity = Math.round((config.petOpacity ?? 1.0) * 100);
  document.getElementById('editOpacity').value = opacity;
  document.getElementById('editOpacityVal').textContent = opacity + '%';
}

document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  const isOllama = cfgProviderType.value === 'ollama';
  const provider = cfgProvider.value;
  const apiKeyVal = document.getElementById('cfgApiKey').value;
  // 按供应商分别保存 API Key（合并进 apiKeys 映射）
  const apiKeys = { ...(currentConfig?.apiKeys || {}), [provider]: apiKeyVal };
  const config = {
    provider,
    providerType: isOllama ? 'ollama' : 'api',
    apiKey: apiKeyVal,
    apiKeys,
    apiEndpoint: isOllama ? '' : document.getElementById('cfgEndpoint').value,
    ollamaEndpoint: isOllama ? (cfgOllamaEndpoint.value || 'http://127.0.0.1:11434') : undefined,
    model: cfgModel.value,
    screenshotInterval: parseInt(cfgInterval.value),
    maxTokens: parseInt(document.getElementById('cfgMaxTokens').value),
    temperature: parseFloat(document.getElementById('cfgTemperature').value),
  };
  await api.invoke('control:save-config', config);
  currentConfig = config;
  showToast('配置已保存！');
});

// --- API Key 显示/隐藏切换 ---
const apiKeyInput = document.getElementById('cfgApiKey');
const apiKeyToggle = document.getElementById('apiKeyToggle');
apiKeyToggle.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  apiKeyToggle.classList.toggle('active', isPassword);
});

// Toast
let toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

// --- Edit Panel ---
let positionDebounceTimer = null;

document.getElementById('editPosX').addEventListener('input', (e) => {
  document.getElementById('editPosXVal').textContent = e.target.value + '%';
  debounceUpdatePetPosition();
});
document.getElementById('editPosY').addEventListener('input', (e) => {
  document.getElementById('editPosYVal').textContent = e.target.value + '%';
  debounceUpdatePetPosition();
});
document.getElementById('editScale').addEventListener('input', (e) => {
  document.getElementById('editScaleVal').textContent = (e.target.value / 100).toFixed(1) + 'x';
  debounceUpdatePetPosition();
});
// 输入框显示值 / 100 = 显示倍数（0.5-1.5x），实际缩放 = 显示倍数 × 0.5

// Reset to defaults
document.getElementById('resetEditBtn').addEventListener('click', async () => {
  await api.invoke('control:reset-pet-defaults');
  document.getElementById('editPosX').value = 0;
  document.getElementById('editPosXVal').textContent = '0%';
  document.getElementById('editPosY').value = 50;
  document.getElementById('editPosYVal').textContent = '50%';
  document.getElementById('editScale').value = 100;
  document.getElementById('editScaleVal').textContent = '1.0x';
  document.getElementById('editOpacity').value = 100;
  document.getElementById('editOpacityVal').textContent = '100%';
  document.getElementById('editFixedPosition').checked = false;
  document.getElementById('editMousePassthrough').checked = false;
  document.getElementById('editAlwaysOnTop').checked = true;
  api.invoke('control:set-opacity', 1.0);
  api.invoke('control:set-fixed-position', false);
  api.invoke('control:set-passthrough', false);
  api.invoke('control:set-topmost', true);
  showToast('已恢复默认');
});

// --- New edit panel controls ---

// Fixed position toggle
document.getElementById('editFixedPosition').addEventListener('change', (e) => {
  api.invoke('control:set-fixed-position', e.target.checked);
});

// Mouse passthrough toggle
document.getElementById('editMousePassthrough').addEventListener('change', (e) => {
  api.invoke('control:set-passthrough', e.target.checked);
});

// Always on top toggle
document.getElementById('editAlwaysOnTop').addEventListener('change', (e) => {
  api.invoke('control:set-topmost', e.target.checked);
});

// Opacity slider
document.getElementById('editOpacity').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  document.getElementById('editOpacityVal').textContent = val + '%';
  api.invoke('control:set-opacity', val / 100);
});

// Position sync from native drag
api.on('main:position-sync', (pos) => {
  document.getElementById('editPosX').value = pos.x;
  document.getElementById('editPosXVal').textContent = pos.x + '%';
  document.getElementById('editPosY').value = pos.y;
  document.getElementById('editPosYVal').textContent = pos.y + '%';
});


function debounceUpdatePetPosition() {
  if (positionDebounceTimer) clearTimeout(positionDebounceTimer);
  positionDebounceTimer = setTimeout(updatePetPosition, 80);
}

async function updatePetPosition() {
  const x = parseInt(document.getElementById('editPosX').value) / 100;
  const y = parseInt(document.getElementById('editPosY').value) / 100;
  // 实际缩放 = 显示倍数 × 0.5（显示 1.0x → 实际 0.5x）
  const scale = (parseInt(document.getElementById('editScale').value) / 100) * 0.5;
  await api.invoke('control:update-pet-position', { x, y, scale });
}

// --- History Panel ---
async function refreshHistory() {
  const history = await api.invoke('control:get-chat-history');
  const list = document.getElementById('historyList');
  if (!history || history.length === 0) {
    list.innerHTML = '<div class="history-empty">暂无对话记录</div>';
    return;
  }
  list.innerHTML = history.map(m => `
    <div class="history-msg ${m.role}">
      <div class="time">${new Date(m.timestamp).toLocaleTimeString()}</div>
      ${m.image ? `<img class="history-img" src="${m.image}" alt="截图">` : ''}
      ${m.content ? `<div class="content">${escapeHtml(m.content)}</div>` : ''}
    </div>
  `).join('');
  list.scrollTop = list.scrollHeight;
}

function addHistoryMessage(msg) {
  const list = document.getElementById('historyList');
  if (list.querySelector('.history-empty')) {
    list.innerHTML = '';
  }
  const div = document.createElement('div');
  div.className = `history-msg ${msg.role}`;
  div.innerHTML = `
    <div class="time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
    ${msg.image ? `<img class="history-img" src="${msg.image}" alt="截图">` : ''}
    ${msg.content ? `<div class="content">${escapeHtml(msg.content)}</div>` : ''}
  `;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- First Run / Info Modal ---
const firstRunModal = document.getElementById('firstRunModal');

async function checkFirstRun() {
  const config = await api.invoke('control:get-config');
  if (config && !config.firstRunComplete) {
    firstRunModal.style.display = 'flex';
    await api.invoke('control:save-config', { firstRunComplete: true });
  }
}

document.getElementById('infoBtn').addEventListener('click', () => {
  firstRunModal.style.display = 'flex';
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
  firstRunModal.style.display = 'none';
});

// --- Notice Modal (GitHub Pages 远程公告) ---
const noticeModal = document.getElementById('noticeModal');

api.on('main:show-notice', (notice) => {
  if (!notice) return;
  document.getElementById('noticeTitle').textContent = notice.title || '呆喵更新公告';
  document.getElementById('noticeVersion').textContent = 'v' + notice.version;
  document.getElementById('noticeTime').textContent = notice.time || '';

  // 渲染更新内容列表
  const list = document.getElementById('noticeContent');
  list.innerHTML = '';
  (notice.content || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });

  noticeModal.style.display = 'flex';

  // 公告已实际显示后，再通知主进程标记为已读（避免未显示就丢失）
  api.invoke('notice:dismiss', notice.version);
});

document.getElementById('noticeDismissBtn').addEventListener('click', () => {
  noticeModal.style.display = 'none';
});

// --- Personality Tab ---
let currentPersonalityId = 'energetic';

async function loadPersonalities() {
  const all = await api.invoke('personality:get-all');
  const current = await api.invoke('personality:get-current');
  currentPersonalityId = current ? current.id : 'energetic';
  renderCurrentPersonality(current || all[0]);
  renderPersonalityCards(all);
}

function renderCurrentPersonality(p) {
  if (!p) return;
  document.getElementById('personaCurrentIcon').textContent = p.icon;
  document.getElementById('personaCurrentName').textContent = p.name;
  document.getElementById('personaCurrentDesc').textContent = p.description;
  // Also update dashboard card
  document.getElementById('dashPersonaIcon').textContent = p.icon;
  document.getElementById('dashPersonaName').textContent = p.name;
}

function renderPersonalityCards(all) {
  const grid = document.getElementById('personaGrid');
  grid.innerHTML = all.map(p => `
    <div class="persona-card${p.id === currentPersonalityId ? ' selected' : ''}" data-pid="${p.id}">
      <div class="persona-card-icon">${p.icon}</div>
      <div class="persona-card-name">${p.name}</div>
      <div class="persona-card-desc">${p.description}</div>
      <div class="persona-card-tags">${p.tags.map(t => `<span class="persona-tag">${t}</span>`).join('')}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.persona-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.dataset.pid;
      await api.invoke('personality:set-current', id);
      currentPersonalityId = id;
      const current = await api.invoke('personality:get-current');
      renderCurrentPersonality(current);
      renderPersonalityCards(all);
      // Show preview
      const text = await api.invoke('personality:preview', id);
      document.getElementById('personaPreviewText').textContent = text;
      document.getElementById('personaPreview').style.display = 'block';
      showToast('已切换为 ' + current.name);
    });
  });
}

// --- Init ---
checkFirstRun();
loadConfigToForm();
// Load current personality for dashboard card
(async () => {
  const current = await api.invoke('personality:get-current');
  if (current) {
    document.getElementById('dashPersonaIcon').textContent = current.icon;
    document.getElementById('dashPersonaName').textContent = current.name;
  }
})();
