// js/auth.js
// Módulo de manejo de sesión: login, logout, y modal de sesión expirada.

import { login as apiLogin, ApiError } from "./api.js";
import { saveToken, getToken, clearToken } from "./storage.js";

let onSessionExpiredCallback = null;

/**
 * Registra un callback que se ejecuta cuando la sesión expira (401).
 * main.js lo usa para mostrar el login de nuevo sin recargar la página.
 */
function onSessionExpired(callback) {
  onSessionExpiredCallback = callback;
}

/**
 * Intenta hacer login. Lanza ApiError si las credenciales son inválidas.
 */
async function attemptLogin(email, password) {
  const result = await apiLogin(email, password);
  saveToken(result.token);
  return result.user;
}

/**
 * Se llama cuando cualquier petición a la API devuelve 401.
 * Limpia el token y dispara el callback de sesión expirada (modal),
 * SIN usar window.location.reload().
 */
function handleSessionExpired() {
  clearToken();
  if (typeof onSessionExpiredCallback === "function") {
    onSessionExpiredCallback();
  }
}

function isAuthenticated() {
  return Boolean(getToken());
}

function logout() {
  clearToken();
}

export {
  attemptLogin,
  handleSessionExpired,
  onSessionExpired,
  isAuthenticated,
  logout,
};