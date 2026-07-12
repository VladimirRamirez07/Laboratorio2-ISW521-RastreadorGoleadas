// js/api.js
// Módulo de comunicación con la API. NO maneja DOM ni presentación.

const BASE_URL = "http://localhost:3000/proxy";
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s

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
 * Fetch genérico con backoff exponencial para 429/500.
 * Sin JWT — las peticiones van sin Authorization header.
 */
async function apiFetch(endpoint, onRetry) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const response = await fetch(`${BASE_URL}${endpoint}?_=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 401) {
      throw new ApiError("No autorizado", 401);
    }

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

    throw new ApiError(`Error inesperado: ${response.status}`, response.status);
  }
}

async function getGames(onRetry) {
  const data = await apiFetch("/get/games", onRetry);
  return data.games || data;
}

async function getTeams(onRetry) {
  const data = await apiFetch("/get/teams", onRetry);
  return data.teams || data;
}

/**
 * Reintenta obtener equipos en segundo plano (Reto de Resiliencia 2.2).
 * Cuando tiene éxito llama onSuccess(equipos) para re-renderizar sin recargar.
 */
async function getTeamsBackground(onRetry, onSuccess) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    await sleep(BASE_DELAY_MS * Math.pow(2, attempt));

    try {
      const response = await fetch(`${BASE_URL}/get/teams?_=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
        cache: "no-store",
      });

      if (response.ok) {
        const json = await response.json();
        const equipos = json.teams || json;
        if (typeof onSuccess === "function") onSuccess(equipos);
        return;
      }

      if (response.status === 429 || response.status === 500) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        if (typeof onRetry === "function") onRetry(attempt + 1, delayMs, response.status);
      }

    } catch {
      // Error de red: seguir reintentando silenciosamente
    }

    attempt++;
  }
}

export { getGames, getTeams, getTeamsBackground, ApiError };