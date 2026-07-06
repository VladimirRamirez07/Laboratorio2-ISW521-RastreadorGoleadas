// js/main.js
import { getGames, getTeams, ApiError } from "./api.js";
import {
  attemptLogin,
  handleSessionExpired,
  onSessionExpired,
  isAuthenticated,
  logout,
} from "./auth.js";
import {
  saveToCache,
  getFromCache,
  getToken,
  saveUserName,
  getUserName,
} from "./storage.js";
import { obtenerGoleadas, enriquecerConEquipos } from "./goleadas.js";

// ===== DOM =====
const loginScreen        = document.getElementById("login-screen");
const appScreen          = document.getElementById("app-screen");
const loginForm          = document.getElementById("login-form");
const loginBtn           = document.getElementById("login-btn");
const loginError         = document.getElementById("login-error");
const userNameEl         = document.getElementById("user-name");
const lastUpdateEl       = document.getElementById("last-update");
const dataBadgeEl        = document.getElementById("data-badge");
const logoutBtn          = document.getElementById("logout-btn");
const reloadBtn          = document.getElementById("reload-btn");
const searchInput        = document.getElementById("search-input");
const sortSelect         = document.getElementById("sort-select");
const goleadasList       = document.getElementById("goleadas-list");
const totalGoleadasEl    = document.getElementById("total-goleadas");
const loadingIndicator   = document.getElementById("loading-indicator");
const emptyMsg           = document.getElementById("empty-msg");
const statusBar          = document.getElementById("status-bar");
const sessionModal       = document.getElementById("session-modal");
const sessionModalBtn    = document.getElementById("session-modal-btn");
const logoutModal        = document.getElementById("logout-modal");
const logoutConfirmBtn   = document.getElementById("logout-confirm-btn");
const logoutCancelBtn    = document.getElementById("logout-cancel-btn");
const retryToast         = document.getElementById("retry-toast");
const retryToastText     = document.getElementById("retry-toast-text");
const test401Btn         = document.getElementById("test-401-btn");
const test500Btn         = document.getElementById("test-500-btn");
const test429Btn         = document.getElementById("test-429-btn");

const BASE_PROXY = "http://localhost:3000/proxy";
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutos

let currentUserName = "";
let goleadasCompletas = []; // cache en memoria para filtrar/ordenar sin refetch
let autoRefreshTimer = null;

// ===== NAVEGACION =====
function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  sessionModal.classList.add("hidden");
  logoutModal.classList.add("hidden");
  detenerAutoRefresh();
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

  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const user = await attemptLogin(email, password);
    currentUserName = user.name || user.email;
    saveUserName(currentUserName);
    userNameEl.textContent = currentUserName;
    showApp();
    await cargarGoleadas();
    iniciarAutoRefresh();
  } catch (err) {
    loginError.textContent =
      err instanceof ApiError
        ? err.message
        : "No se pudo conectar con el servidor. Intenta de nuevo.";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Iniciar sesion";
  }
});

// ===== LOGOUT CON CONFIRMACION =====
logoutBtn.addEventListener("click", () => {
  logoutModal.classList.remove("hidden");
});

logoutCancelBtn.addEventListener("click", () => {
  logoutModal.classList.add("hidden");
});

logoutConfirmBtn.addEventListener("click", () => {
  logout();
  showLogin();
  loginForm.reset();
});

// ===== SESION EXPIRADA =====
onSessionExpired(() => {
  sessionModal.classList.remove("hidden");
  detenerAutoRefresh();
});

sessionModalBtn.addEventListener("click", () => {
  sessionModal.classList.add("hidden");
  showLogin();
  loginForm.reset();
});

// ===== AUTO-REFRESH =====
function iniciarAutoRefresh() {
  detenerAutoRefresh();
  autoRefreshTimer = setInterval(async () => {
    if (isAuthenticated()) {
      await cargarGoleadas();
    }
  }, AUTO_REFRESH_MS);
}

function detenerAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

// ===== RECARGA MANUAL =====
reloadBtn.addEventListener("click", () => cargarGoleadas());

// ===== BUSQUEDA EN TIEMPO REAL =====
searchInput.addEventListener("input", () => {
  aplicarFiltroYOrden();
});

// ===== ORDENAMIENTO =====
sortSelect.addEventListener("change", () => {
  aplicarFiltroYOrden();
});

function aplicarFiltroYOrden() {
  const query = searchInput.value.trim().toLowerCase();
  const criterio = sortSelect.value;

  let resultado = goleadasCompletas.filter((p) => {
    const localNombre = (p.equipoLocal.name_en || "").toLowerCase();
    const visitanteNombre = (p.equipoVisitante.name_en || "").toLowerCase();
    return localNombre.includes(query) || visitanteNombre.includes(query);
  });

  if (criterio === "fecha") {
    resultado = [...resultado].sort(
      (a, b) => new Date(a.local_date) - new Date(b.local_date)
    );
  } else {
    resultado = [...resultado].sort((a, b) => b.diferencia - a.diferencia);
  }

  renderGoleadas(resultado);
}

// ===== TIMESTAMP DE ULTIMA ACTUALIZACION =====
function actualizarTimestamp(desdeCache) {
  const ahora = new Date();
  const hora  = ahora.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
  lastUpdateEl.textContent = `Actualizado: ${hora}`;

  dataBadgeEl.classList.remove("hidden", "live", "cache");
  if (desdeCache) {
    dataBadgeEl.textContent = "Cache";
    dataBadgeEl.classList.add("cache");
  } else {
    dataBadgeEl.textContent = "En vivo";
    dataBadgeEl.classList.add("live");
  }
}

// ===== TOAST BACKOFF =====
function mostrarRetryToast(attempt, delayMs, status) {
  let secondsLeft = Math.ceil(delayMs / 1000);
  retryToast.classList.remove("hidden");

  const motivo = status === 429 ? "limite de peticiones alcanzado" : "error del servidor";
  retryToastText.textContent =
    `Reintentando (${motivo})... intento ${attempt}, proximo en ${secondsLeft}s`;

  const intervalId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      clearInterval(intervalId);
      retryToast.classList.add("hidden");
      return;
    }
    retryToastText.textContent =
      `Reintentando (${motivo})... intento ${attempt}, proximo en ${secondsLeft}s`;
  }, 1000);
}

// ===== CARGA DE DATOS =====
async function cargarGoleadas() {
  loadingIndicator.classList.remove("hidden");
  emptyMsg.classList.add("hidden");
  statusBar.classList.add("hidden");
  goleadasList.innerHTML = "";

  const token = getToken();
  let partidos = null;
  let equipos  = null;
  let usandoCacheGames = false;
  let usandoCacheTeams = false;

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
      emptyMsg.textContent =
        "No se pudieron cargar los partidos y no hay datos guardados localmente.";
      emptyMsg.classList.remove("hidden");
      return;
    }
  }

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
      equipos = null;
    }
  }

  const desdeCache = usandoCacheGames || usandoCacheTeams;

  if (desdeCache) {
    statusBar.textContent =
      "Mostrando datos guardados localmente (no actualizados). La conexion con el servidor fallo.";
    statusBar.classList.remove("hidden");
  }

  actualizarTimestamp(desdeCache);

  const goleadas = obtenerGoleadas(partidos);
  goleadasCompletas  = enriquecerConEquipos(goleadas, equipos);

  loadingIndicator.classList.add("hidden");
  aplicarFiltroYOrden();
}

// ===== RENDER =====
function renderGoleadas(goleadas) {
  totalGoleadasEl.textContent = `Total de goleadas: ${goleadas.length}`;

  if (goleadas.length === 0) {
    emptyMsg.textContent = "No se encontraron goleadas.";
    emptyMsg.classList.remove("hidden");
    goleadasList.innerHTML = "";
    return;
  }

  emptyMsg.classList.add("hidden");
  goleadasList.innerHTML = goleadas.map((p, i) => crearTarjetaHTML(p, i + 1)).join("");
}

function crearTarjetaHTML(partido, rank) {
  const local     = partido.equipoLocal;
  const visitante = partido.equipoVisitante;

  const localHTML = local._esRespaldo
    ? `<span class="team-fallback">${local.name_en}</span>`
    : `${local.flag ? `<img src="${local.flag}" alt="${local.name_en}" />` : ""}<span>${local.name_en}</span>`;

  const visitanteHTML = visitante._esRespaldo
    ? `<span class="team-fallback">${visitante.name_en}</span>`
    : `${visitante.flag ? `<img src="${visitante.flag}" alt="${visitante.name_en}" />` : ""}<span>${visitante.name_en}</span>`;

  const fecha = partido.local_date
    ? new Date(partido.local_date).toLocaleDateString("es-CR", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "";

  return `
    <li class="goleada-card">
      <span class="goleada-rank">#${rank}</span>
      <div class="goleada-teams">
        ${localHTML}
        <span class="vs">vs</span>
        ${visitanteHTML}
      </div>
      <div class="goleada-info">
        <span class="goleada-score">${partido.home_score} - ${partido.away_score}</span>
        <span class="goleada-diff">+${partido.diferencia} goles</span>
        ${fecha ? `<span class="goleada-date">${fecha}</span>` : ""}
      </div>
    </li>
  `;
}

// ===== BOTONES DE PRUEBA =====
test401Btn.addEventListener("click", async () => {
  const token = getToken();
  const response = await fetch(`${BASE_PROXY}/test/401`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) handleSessionExpired();
});

test500Btn.addEventListener("click", async () => {
  const token = getToken();
  let attempt = 0;
  const maxRetries = 4;
  const baseDelay  = 1000;

  const tryFetch = async () => {
    const response = await fetch(`${BASE_PROXY}/test/500`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 500) {
      if (attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        mostrarRetryToast(attempt + 1, delayMs, 500);
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs));
        await tryFetch();
      } else {
        const cached = getFromCache("games");
        if (cached) {
          statusBar.textContent =
            "Mostrando datos guardados localmente (no actualizados). El servidor fallo tras 4 reintentos.";
          statusBar.classList.remove("hidden");
        }
      }
    }
  };
  await tryFetch();
});

test429Btn.addEventListener("click", async () => {
  const token = getToken();
  let attempt = 0;
  const maxRetries = 4;
  const baseDelay  = 1000;

  const tryFetch = async () => {
    const response = await fetch(`${BASE_PROXY}/test/429`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 429) {
      if (attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        mostrarRetryToast(attempt + 1, delayMs, 429);
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs));
        await tryFetch();
      }
    }
  };
  await tryFetch();
});

// ===== INICIALIZACION =====
function init() {
  if (isAuthenticated()) {
    currentUserName = getUserName();
    userNameEl.textContent = currentUserName;
    showApp();
    cargarGoleadas();
    iniciarAutoRefresh();
  } else {
    showLogin();
  }
}

init();