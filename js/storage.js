// js/storage.js
// Caché offline con localStorage. Sin token JWT.

const STORAGE_PREFIX = "rastreador_goleadas_";

function saveToCache(key, data) {
  const payload = {
    data,
    cachedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
}

function getFromCache(key) {
  const raw = localStorage.getItem(STORAGE_PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export { saveToCache, getFromCache };