// js/storage.js
// Módulo de caché offline. Guarda y lee la última respuesta exitosa de cada endpoint.

const STORAGE_PREFIX = "rastreador_goleadas_";

/**
 * Guarda datos en localStorage junto con un timestamp.
 * @param {string} key - identificador del recurso, ej. "games" o "teams"
 * @param {any} data
 */
function saveToCache(key, data) {
  const payload = {
    data,
    cachedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
}

/**
 * Lee datos cacheados de localStorage.
 * @param {string} key
 * @returns {{data: any, cachedAt: string} | null}
 */
function getFromCache(key) {
  const raw = localStorage.getItem(STORAGE_PREFIX + key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Limpia el token guardado (usado en logout o 401).
 */
function clearToken() {
  sessionStorage.removeItem(STORAGE_PREFIX + "token");
}

function saveToken(token) {
  sessionStorage.setItem(STORAGE_PREFIX + "token", token);
}

function getToken() {
  return sessionStorage.getItem(STORAGE_PREFIX + "token");
}

export { saveToCache, getFromCache, saveToken, getToken, clearToken };