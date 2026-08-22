const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const TOTALS_PATH = path.join(app.getPath('userData'), 'totals.json');

class StatsTracker {
  constructor() {
    this.startTime = null;
    this.messageCount = 0;
    this.totalTokens = 0;
    this.status = 'stopped';
    this.totalUptime = 0;
    this.totalMessages = 0;
    this.totalTokensAll = 0;
    this.loadTotals();
  }

  loadTotals() {
    try {
      if (fs.existsSync(TOTALS_PATH)) {
        const data = JSON.parse(fs.readFileSync(TOTALS_PATH, 'utf-8'));
        this.totalUptime = data.totalUptime || 0;
        this.totalMessages = data.totalMessages || 0;
        this.totalTokensAll = data.totalTokensAll || 0;
      }
    } catch { /* ignore */ }
  }

  saveTotals() {
    try {
      fs.writeFileSync(TOTALS_PATH, JSON.stringify({
        totalUptime: this.totalUptime,
        totalMessages: this.totalMessages,
        totalTokensAll: this.totalTokensAll,
      }));
    } catch { /* ignore */ }
  }

  start() {
    this.startTime = Date.now();
    this.messageCount = 0;
    this.totalTokens = 0;
    this.status = 'running';
  }

  stop() {
    this.status = 'stopped';
  }

  setIdle(idle) {
    if (this.status === 'running' || this.status === 'idle') {
      this.status = idle ? 'idle' : 'running';
    }
  }

  addMessage() {
    this.messageCount++;
    this.totalMessages++;
  }

  addTokens(count) {
    this.totalTokens += count;
    this.totalTokensAll += count;
  }

  addUptime(seconds) {
    this.totalUptime += seconds;
  }

  /**
   * 将累计值写盘。由外部定时调用（每 30s）或退出时调用，
   * 避免每次 addXxx 都同步写磁盘。
   */
  flush() {
    this.saveTotals();
  }

  getStats() {
    const uptime = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    return {
      uptime,
      messages: this.messageCount,
      tokens: this.totalTokens,
      status: this.status,
      totalUptime: this.totalUptime,
      totalMessages: this.totalMessages,
      totalTokensAll: this.totalTokensAll,
    };
  }
}

module.exports = { StatsTracker };
