const store = new Map();

function nowMs() {
  return Date.now();
}

function cleanup() {
  const t = nowMs();
  for (const [key, entry] of store.entries()) {
    if (!entry || !entry.expiresAtMs || entry.expiresAtMs <= t) {
      store.delete(key);
    }
  }
}

export function setInteractionState(key, value, ttlMs = 10 * 60 * 1000) {
  cleanup();
  store.set(key, { value, expiresAtMs: nowMs() + ttlMs });
}

export function getInteractionState(key) {
  cleanup();
  const entry = store.get(key);
  return entry ? entry.value : null;
}

export function deleteInteractionState(key) {
  store.delete(key);
}
