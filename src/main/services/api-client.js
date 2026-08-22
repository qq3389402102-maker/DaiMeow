class ApiClient {
  constructor(configStore, chatManager, statsTracker, personalityManager, ollamaProvider) {
    this.configStore = configStore;
    this.chatManager = chatManager;
    this.statsTracker = statsTracker;
    this.personalityManager = personalityManager;
    this.ollamaProvider = ollamaProvider;
  }

  getSystemPrompt() {
    return this.personalityManager.buildSystemPrompt();
  }

  // 提取非空的历史消息（供两个请求路径共用）
  _filterHistory() {
    return this.chatManager.getMessages().filter(m => {
      if (typeof m.content === 'string') return m.content.trim() !== '';
      if (Array.isArray(m.content)) return m.content.some(c => c.type === 'text' ? c.text.trim() !== '' : true);
      return true;
    });
  }

  async sendScreenshot(base64Image) {
    const config = this.configStore.getAll();

    if (config.providerType === 'ollama') {
      return this.sendViaOllama(base64Image, config);
    }

    // 按当前供应商解析 API Key（优先 apiKeys[provider]，旧单 key 兜底）
    const apiKey = config.apiKeys?.[config.provider] || config.apiKey || '';
    if (!apiKey) {
      throw new Error('API Key 未配置，请在设置中填入 API Key');
    }

    // Build user message
    const userMsg = {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: base64Image, detail: 'low' },
        },
        {
          type: 'text',
          text: '（你看了一眼屏幕）看到了什么？简单评论一下喵~',
        },
      ],
    };

    // Store user msg for history display
    this.chatManager.addMessage(userMsg);

    // Send system prompt + last 3 exchanges (6 messages) + current screenshot
    const allHistory = this._filterHistory();
    const recentHistory = allHistory.slice(-6).map(m => {
      if (m.role === 'assistant' && typeof m.content === 'string') {
        return { ...m, content: m.content.slice(0, 25) };
      }
      return m;
    }); // last 3 pairs, assistant replies truncated
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      ...recentHistory,
    ];

    // Send API request with retry on overload
    // 仅对已知支持思考开关的 provider 附带 thinking:disabled，避免其他服务商
    // 严格校验未知字段而返回 400。
    const thinkingProviders = ['moonshot', 'deepseek'];
    const disableThinking = thinkingProviders.some(h => config.apiEndpoint.includes(h));
    const requestBody = {
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      ...(disableThinking ? { thinking: { type: 'disabled' } } : {}),
    };

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        console.warn(`[API] Retry ${attempt} after ${attempt * 3}s...`);
        await new Promise(r => setTimeout(r, attempt * 3000));
      }

      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        lastError = new Error(`API 请求失败 (${response.status}): ${errorBody}`);
        if (response.status === 429 || response.status >= 500) continue; // retry
        throw lastError;
      }

      const data = await response.json();
      const msg = data.choices?.[0]?.message || {};
      let reply = (msg.content || '').slice(0, 25);

      if (!reply || reply.trim() === '') {
        lastError = new Error('AI 返回了空内容，请重试');
        if (attempt < 2) continue; // retry on empty
        throw lastError;
      }

      this.chatManager.addMessage({ role: 'assistant', content: reply });
      this.statsTracker.addMessage();
      if (data.usage?.total_tokens) {
        this.statsTracker.addTokens(data.usage.total_tokens);
      }
      return reply;
    }
    throw lastError;
  }

  async sendViaOllama(base64Image, config) {
    if (!config.model) {
      throw new Error('请先在设置中选择 Ollama 模型');
    }

    // Strip data:image prefix for Ollama (needs raw base64)
    const rawBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    // Build user message in Ollama format
    const userMsg = {
      role: 'user',
      content: '（你看了一眼屏幕）看到了什么？简单评论一下喵~',
      images: [rawBase64],
    };

    // Store for history display (text-only version)
    this.chatManager.addMessage(userMsg);

    // Build message history
    const allHistory = this._filterHistory();
    const recentHistory = allHistory.slice(-6).map(m => {
      // Convert OpenAI-format content (array) to Ollama string
      let content = m.content;
      if (Array.isArray(content)) {
        content = content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join(' ')
          .trim() || '（图片）';
      }
      if (m.role === 'assistant' && typeof content === 'string') {
        content = content.slice(0, 25);
      }
      // Preserve images for user messages, strip for assistant
      const msg = { role: m.role, content };
      if (m.role === 'user' && m.images) {
        msg.images = m.images;
      }
      return msg;
    });

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      ...recentHistory,
    ];

    const endpoint = config.ollamaEndpoint || 'http://127.0.0.1:11434';

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        console.warn(`[Ollama] Retry ${attempt} after ${attempt * 3}s...`);
        await new Promise(r => setTimeout(r, attempt * 3000));
      }

      try {
        const data = await this.ollamaProvider.sendChat(endpoint, config.model, messages, {
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        });

        let reply = (data.message?.content || '').slice(0, 25);

        if (!reply || reply.trim() === '') {
          lastError = new Error('Ollama 返回了空内容');
          if (attempt < 2) continue;
          throw lastError;
        }

        this.chatManager.addMessage({ role: 'assistant', content: reply });
        this.statsTracker.addMessage();
        const totalTokens = (data.eval_count || 0) + (data.prompt_eval_count || 0);
        if (totalTokens > 0) {
          this.statsTracker.addTokens(totalTokens);
        }
        return reply;
      } catch (err) {
        if (attempt < 2 && err.message.includes('空内容')) continue;
        throw err;
      }
    }
    throw lastError;
  }
}

module.exports = { ApiClient };
