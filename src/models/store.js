// KV 存储层 — 内存实现，生产环境可替换为 Redis / DynamoDB

class KVStore {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    const raw = this.data.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async set(key, value) {
    this.data.set(key, JSON.stringify(value));
    return true;
  }

  async del(key) {
    this.data.delete(key);
    return true;
  }

  async list(prefix) {
    const results = [];
    for (const [k, v] of this.data.entries()) {
      if (k.startsWith(prefix)) {
        results.push(JSON.parse(v));
      }
    }
    return results;
  }

  async incr(key) {
    let val = await this.get(key);
    if (val === null) val = 0;
    val = (typeof val === 'number' ? val : 0) + 1;
    await this.set(key, val);
    return val;
  }
}

const store = new KVStore();

module.exports = store;
