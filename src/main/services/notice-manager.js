const { getAll, save } = require('./config-store');

// 远程公告地址（GitHub Pages），唯一配置点，方便以后修改
const NOTICE_URL = 'https://qq3389402102-maker.github.io/DaiMeow/notice.json';

// 网络超时（毫秒）——最多等待数秒，超时即放弃，绝不阻塞启动
const REQUEST_TIMEOUT = 5000;

class NoticeManager {
  constructor() {
    this.url = NOTICE_URL;
  }

  /**
   * 异步检查远程公告。
   * 成功且是新公告 → 返回 { version, time, title, content[], force }
   * 无新公告 / 网络异常 / JSON 错误 → 返回 null（静默，不影响运行）
   */
  async check() {
    try {
      const response = await fetch(this.url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return null;

      const data = await response.json();

      // 基础校验：必须有 version 才当作有效公告
      if (!data || typeof data.version !== 'string' || data.version === '') return null;

      const lastNotice = getAll().lastNotice || '';
      const isNew = this._compareVersions(data.version, lastNotice) > 0;
      const isForced = data.force === true;

      // 版本不新且未强制 → 跳过
      // force 公告也走版本去重：已显示过的 force 公告不再重复弹
      if (!isNew && !isForced) return null;
      if (isForced && !isNew) return null;

      return {
        version: data.version,
        time: data.time || '',
        title: data.title || '呆喵更新公告',
        content: Array.isArray(data.content) ? data.content : [],
        force: isForced,
      };
    } catch (err) {
      // 网络异常 / 超时 / JSON 解析失败 → 静默忽略
      console.warn('[Notice] 检查公告失败:', err.message);
      return null;
    }
  }

  /**
   * 公告实际显示后由渲染进程调用，标记已读版本。
   */
  markSeen(version) {
    if (!version) return;
    save({ lastNotice: version });
  }

  /**
   * semver 风格逐段数字比较。a > b 返回 1，a < b 返回 -1，相等返回 0。
   * 容忍 "v1.0.3" 前缀和空值。
   */
  _compareVersions(a, b) {
    const parse = (s) => String(s || '')
      .replace(/^v/i, '')
      .split('.')
      .map(n => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const x = pa[i] || 0;
      const y = pb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }
}

module.exports = { NoticeManager };
