// js/api.js
// Módulo de comunicación con la API. NO maneja DOM ni presentación.

const BASE_URL = "http://localhost:3000/proxy";
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s

// Error personalizado para distinguir tipos de fallo en capas superiores
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hace login contra /auth/authenticate
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: object}>}
 */
async function login(email, password) {
  const response = await fetch(`${BASE_URL}/auth/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    if (response.status === 400) {
      throw new ApiError("Credenciales inválidas", 400);
    }
    throw new ApiError(`Error de login: ${response.status}`, response.status);
  }

  const data = await response.json();
  return data; // { user, token }
}

/**
 * Fetch genérico autenticado con backoff exponencial para 429/500.
 * Lanza ApiError con status 401 si el token expiró/es inválido (sin reintentar).
 * Usa cache: "no-store" para evitar que el navegador sirva respuestas cacheadas
 * y oculte errores reales de autenticación (304 en lugar de 401).
 *
 * @param {string} endpoint - ej. "/get/games"
 * @param {string} token - JWT
 * @param {function} onRetry - callback(attempt, delayMs, status) para mostrar countdown en UI
 */
async function authenticatedFetch(endpoint, token, onRetry) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const response = await fetch(`${BASE_URL}${endpoint}?_=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (response.ok) {
      return await response.json();
    }

    // 401: no se reintenta, se delega a quien llama (auth.js maneja sesión expirada)
    if (response.status === 401) {
      throw new ApiError("Sesión expirada", 401);
    }

    // 429 o 500: backoff exponencial
    if (response.status === 429 || response.status === 500) {
      if (attempt === MAX_RETRIES) {
        throw new ApiError(
          `Falló tras ${MAX_RETRIES} reintentos (status ${response.status})`,
          response.status
        );
      }

      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);

      if (typeof onRetry === "function") {
        onRetry(attempt + 1, delayMs, response.status);
      }

      await sleep(delayMs);
      attempt++;
      continue;
    }

    // Cualquier otro código de error no contemplado
    throw new ApiError(`Error inesperado: ${response.status}`, response.status);
  }
}

/**
 * Obtiene todos los partidos.
 * La API devuelve { games: [...] }, extraemos el array directamente.
 */
async function getGames(token, onRetry) {
  const data = await authenticatedFetch("/get/games", token, onRetry);
  return data.games || data;
}

/**
 * Obtiene todos los equipos.
 * La API devuelve { teams: [...] }, extraemos el array directamente.
 */
async function getTeams(token, onRetry) {
  const data = await authenticatedFetch("/get/teams", token, onRetry);
  return data.teams || data;
}

export { login, getGames, getTeams, ApiError };