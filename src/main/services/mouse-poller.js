const { screen } = require('electron');

class MousePoller {
  constructor(petWindow, options = {}) {
    this.petWindow = petWindow;
    this.interval = null;
    this.intervalMs = options.intervalMs || 50;
    this.lastX = -1;
    this.lastY = -1;
  }

  start() {
    this.interval = setInterval(() => {
      try {
        const point = screen.getCursorScreenPoint();
        const dx = Math.abs(point.x - this.lastX);
        const dy = Math.abs(point.y - this.lastY);
        if (dx < 2 && dy < 2) return;

        this.lastX = point.x;
        this.lastY = point.y;

        const bounds = this.petWindow.getBounds();
        const { width, height } = screen.getPrimaryDisplay().bounds;

        // Mouse position relative to pet window center (-1 to 1 range)
        const relX = ((point.x - (bounds.x + bounds.width / 2)) / (width / 2));
        const relY = ((point.y - (bounds.y + bounds.height / 2)) / (height / 2));

        this.petWindow.webContents.send('pet:mouse-pos', {
          relX: Math.max(-1, Math.min(1, relX)),
          relY: Math.max(-1, Math.min(1, relY)),
        });
      } catch (err) {
        // Window not ready yet, ignore
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

module.exports = { MousePoller };
