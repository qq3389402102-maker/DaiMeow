const { powerMonitor } = require('electron');

class IdleDetector {
  constructor(options = {}) {
    this.threshold = options.threshold || 60; // seconds
    this.isIdle = false;
    this.interval = null;
    this.onIdleChange = options.onIdleChange || null;
  }

  start() {
    this.interval = setInterval(() => {
      const idleTime = powerMonitor.getSystemIdleTime();
      const wasIdle = this.isIdle;
      this.isIdle = idleTime >= this.threshold;

      if (this.onIdleChange && wasIdle !== this.isIdle) {
        this.onIdleChange(this.isIdle);
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

module.exports = { IdleDetector };
