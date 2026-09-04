// ---- The cache class (from Week 1) ----
class SimpleCache {
  constructor() {
    this.store = {};
  }

  set(key, value, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store[key] = { value, expiresAt };
  }

  get(key) {
    const entry = this.store[key];
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      delete this.store[key];
      return null;
    }
    return entry.value;
  }
}

// ---- This week: cache in front of a slow fetch ----
const cache = new SimpleCache();

function slowFetchUser(id) {
  const start = Date.now();
  while (Date.now() - start < 2000) {
    // burn 2 seconds to simulate a slow DB
  }
  return { id, name: "Emmanuel", role: "backend dev" };
}

function getUser(id) {
  const key = "user:" + id;

  const cached = cache.get(key);
  if (cached) {
    console.log("HIT  — instant");
    return cached;
  }

  console.log("MISS — doing slow fetch...");
  const user = slowFetchUser(id);
  cache.set(key, user, 10);
  return user;
}

console.log(getUser(1));
console.log(getUser(1));