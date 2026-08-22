const PERSONALITIES = require('./personalities.js');

class PersonalityManager {
  constructor() {
    this.personalities = PERSONALITIES;
    this.currentId = 'energetic'; // default
  }

  getAll() {
    return this.personalities;
  }

  getCurrent() {
    return this.personalities.find(p => p.id === this.currentId) || this.personalities[0];
  }

  setCurrent(id) {
    if (this.personalities.find(p => p.id === id)) {
      this.currentId = id;
      return true;
    }
    return false;
  }

  buildSystemPrompt() {
    const current = this.getCurrent();
    return current ? current.system_prompt : '';
  }

  getPreview(id) {
    const p = this.personalities.find(p => p.id === id);
    return p ? p.preview : '';
  }
}

module.exports = { PersonalityManager };
