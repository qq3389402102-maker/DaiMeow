// Local HTTP server to serve Live2D model files to the pet renderer.
// Avoids binary corruption issues with custom protocols.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { app } = require('electron');

// 开发时：项目根/model；打包后：resources/model（extraResources 外置）
const MODEL_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'model')
  : path.join(__dirname, '..', '..', '..', 'model');

class ModelServer {
  constructor() {
    this.server = null;
    this.port = 0;
    this.fileCache = new Map(); // 文件内容缓存（模型文件是静态的，缓存后避免重复读盘）
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          let filePath = path.join(MODEL_DIR, decodeURIComponent(url.pathname));

          // Security: ensure path is within MODEL_DIR
          if (!filePath.startsWith(MODEL_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          // Default to model3.json
          if (req.url === '/' || url.pathname === '/') {
            filePath = path.join(MODEL_DIR, 'daimeow', 'daimeow.model3.json');
          }

          if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.json': 'application/json',
            '.png': 'image/png',
            '.moc3': 'application/octet-stream',
            '.bin': 'application/octet-stream',
          };
          const mime = mimeTypes[ext] || 'application/octet-stream';

          let data = this.fileCache.get(filePath);
          if (data === undefined) {
            data = fs.readFileSync(filePath);
            this.fileCache.set(filePath, data);
          }
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': data.length,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          });
          res.end(data);
        } catch (err) {
          res.writeHead(500);
          res.end('Internal error');
        }
      });

      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        console.log('[ModelServer] Started on http://127.0.0.1:' + this.port);
        resolve(this.port);
      });

      this.server.on('error', reject);
    });
  }

  getBaseUrl() {
    return 'http://127.0.0.1:' + this.port;
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('[ModelServer] Stopped');
    }
  }
}

module.exports = { ModelServer };
