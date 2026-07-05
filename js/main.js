// js/main.js
// Orquestador: conecta DOM, eventos y los módulos de lógica/datos.
// Es el único archivo que manipula el DOM directamente.

import { getGames, getTeams, ApiError } from "./api.js";
import {
  attemptLogin,
  handleSessionExpired,
  onSessionExpired,
  isAuthenticated,
  logout,
} from "./auth.js";
import { saveToCache, getFromCache, getToken } from "./storage.js";
import { obtenerGoleadas, enriquecerConEquipos } from "./goleadas.js";

// ===== REFERENCIAS AL DOM =====
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const userNameEl = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");
const reloadBtn = document.getElementById("reload-btn");
const goleadasList = document.getElementById("goleadas-list");
const totalGoleadasEl = document.getElementById("total-goleadas");
const loadingIndicator = document.getElementById("loading-indicator");
const emptyMsg = document.getElementById("empty-msg");
const statusBar = document.getElementById("status-bar");
const sessionModal = document.getElementById("session-modal");
const sessionModalBtn = document.getElementById("session-modal-btn");
const retryToast = document.getElementById("retry-toast");
const retryToastText = document.getElementById("retry-toast-text");

let currentUserName = "";

// ===== NAVEGACIÓN ENTRE PANTALLAS =====
function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  sessionModal.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

// ===== LOGIN =====
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "Ingresando...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const user = await attemptLogin(email, password);
    currentUserName = user.name || user.email;
    userNameEl.textContent = currentUserName;
    showApp();
    await cargarGoleadas();
  } catch (err) {
    if (err instanceof ApiError) {
      loginError.textContent = err.message;
    } else {
      loginError.textContent = "No se pudo conectar con el servidor. Intenta de nuevo.";
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Iniciar sesión";
  }
});

// ===== LOGOUT =====
logoutBtn.addEventListener("click", () => {
  logout();
  showLogin();
  loginForm.reset();
});

// ===== SESIÓN EXPIRADA (401) — sin reload =====
onSessionExpired(() => {
  sessionModal.classList.remove("hidden");
});

sessionModalBtn.addEventListener("click", () => {
  sessionModal.classList.add("hidden");
  showLogin();
  loginForm.reset();
});

// ===== RECARGAR DATOS MANUALMENTE =====
reloadBtn.addEventListener("click", () => {
  cargarGoleadas();
});

// ===== COUNTDOWN VISUAL PARA BACKOFF (429 / 500) =====
function mostrarRetryToast(attempt, delayMs, status) {
  let secondsLeft = Math.ceil(delayMs / 1000);
  retryToast.classList.remove("hidden");

  const motivo = status === 429 ? "límite de peticiones alcanzado" : "error del servidor";
  retryToastText.textContent = `Reintentando (${motivo})... intento ${attempt}, próximo en ${secondsLeft}s`;

  const intervalId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      clearInterval(intervalId);
      retryToast.classList.add("hidden");
      return;
    }
    retryToastText.textContent = `Reintentando (${motivo})... intento ${attempt}, próximo en ${secondsLeft}s`;
  }, 1000);
}

// ===== CARGA Y RENDER DE GOLEADAS =====
async function cargarGoleadas() {
  loadingIndicator.classList.remove("hidden");
  emptyMsg.classList.add("hidden");
  statusBar.classList.add("hidden");
  goleadasList.innerHTML = "";

  const token = getToken();
  let partidos = null;
  let equipos = null;
  let usandoCacheGames = false;
  let usandoCacheTeams = false;

  // --- Obtener partidos (crítico: si falla y no hay caché, no podemos continuar) ---
  try {
    partidos = await getGames(token, mostrarRetryToast);
    saveToCache("games", partidos);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      handleSessionExpired();
      loadingIndicator.classList.add("hidden");
      return;
    }
    const cached = getFromCache("games");
    if (cached) {
      partidos = cached.data;
      usandoCacheGames = true;
    } else {
      loadingIndicator.classList.add("hidden");
      emptyMsg.textContent = "No se pudieron cargar los partidos y no hay datos guardados localmente.";
      emptyMsg.classList.remove("hidden");
      return;
    }
  }

  // --- Obtener equipos (no crítico: si falla, goleadas.js usa respaldo con ids) ---
  try {
    equipos = await getTeams(token, mostrarRetryToast);
    saveToCache("teams", equipos);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      handleSessionExpired();
      loadingIndicator.classList.add("hidden");
      return;
    }
    const cached = getFromCache("teams");
    if (cached) {
      equipos = cached.data;
      usandoCacheTeams = true;
    } else {
      equipos = null; // goleadas.js maneja el respaldo con id crudo
    }
  }

  // --- Indicador de datos no actualizados (offline) ---
  if (usandoCacheGames || usandoCacheTeams) {
    statusBar.textContent = "⚠ Mostrando datos guardados localmente (no actualizados). La conexión con el servidor falló.";
    statusBar.classList.remove("hidden");
  }

  // --- Procesar y renderizar ---
  const goleadas = obtenerGoleadas(partidos);
  const goleadasConEquipos = enriquecerConEquipos(goleadas, equipos);

  loadingIndicator.classList.add("hidden");
  renderGoleadas(goleadasConEquipos);
}

function renderGoleadas(goleadas) {
  totalGoleadasEl.textContent = `Total de goleadas: ${goleadas.length}`;

  if (goleadas.length === 0) {
    emptyMsg.textContent = "No se encontraron goleadas (diferencia ≥ 3 goles).";
    emptyMsg.classList.remove("hidden");
    return;
  }

  goleadasList.innerHTML = goleadas
    .map((partido) => crearTarjetaHTML(partido))
    .join("");
}

function crearTarjetaHTML(partido) {
  const local = partido.equipoLocal;
  const visitante = partido.equipoVisitante;

  const localHTML = local._esRespaldo
    ? `<span class="team-fallback">${local.name_en}</span>`
    : `${local.flag ? `<img src="${local.flag}" alt="${local.name_en}" />` : ""}<span>${local.name_en}</span>`;

  const visitanteHTML = visitante._esRespaldo
    ? `<span class="team-fallback">${visitante.name_en}</span>`
    : `${visitante.flag ? `<img src="${visitante.flag}" alt="${visitante.name_en}" />` : ""}<span>${visitante.name_en}</span>`;

  return `
    <li class="goleada-card">
      <div class="goleada-teams">
        ${localHTML}
        <span class="vs">vs</span>
        ${visitanteHTML}
      </div>
      <div class="goleada-score">${partido.home_score} - ${partido.away_score}</div>
      <div class="goleada-diff">+${partido.diferencia} goles</div>
    </li>
  `;
}

// ===== INICIALIZACIÓN =====
function init() {
  if (isAuthenticated()) {
    showApp();
    cargarGoleadas();
  } else {
    showLogin();
  }
}

init();