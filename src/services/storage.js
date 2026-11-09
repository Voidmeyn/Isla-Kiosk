


const memory = new Map();

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? (memory.has(key) ? memory.get(key) : fallback) : JSON.parse(raw);
    } catch {
      return memory.has(key) ? memory.get(key) : fallback;
    }
  },
  set(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {   }
  },
  remove(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch {   }
  },
};
