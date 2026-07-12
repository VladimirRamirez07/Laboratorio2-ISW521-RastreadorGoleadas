// js/main.js
// Orquestador principal. Único archivo que toca el DOM.
// Maneja las 5 pantallas via show/hide de secciones.

import { getGames, getTeams, getTeamsBackground, ApiError } from "./api.js";
import { saveToCache, getFromCache } from "./storage.js";
import { obtenerGoleadas, enriquecerConEquipos, parsearGoleadores } from "./goleadas.js";
import { inicializarChat, construirChatUI, inicializarChatPantallaCompleta } from "./chat.js";

// ===== CONSTANTES =====
const BASE_PROXY     = "http://localhost:3000/proxy";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// ===== ESTADO GLOBAL =====
let goleadasCompletas = [];
let todosLosPartidos  = [];
let autoRefreshTimer  = null;

// ===== REFERENCIAS DOM — NAVEGACION =====
const navDashboard    = document.getElementById("nav-dashboard");
const navDetalle      = document.getElementById("nav-detalle");
const navStats        = document.getElementById("nav-stats");
const navIA           = document.getElementById("nav-ia");
const navGrupos       = document.getElementById("nav-grupos");

const screenDashboard = document.getElementById("screen-dashboard");
const screenDetalle   = document.getElementById("screen-detalle");
const screenStats     = document.getElementById("screen-stats");
const screenIA        = document.getElementById("screen-ia");
const screenGrupos    = document.getElementById("screen-grupos");

const todasLasPantallas = [screenDashboard, screenDetalle, screenStats, screenIA, screenGrupos];
const todosLosNavLinks  = [navDashboard, navDetalle, navStats, navIA, navGrupos];

// ===== REFERENCIAS DOM — DASHBOARD =====
const lastUpdateEl     = document.getElementById("last-update");
const dataBadgeEl      = document.getElementById("data-badge");
const reloadBtn        = document.getElementById("reload-btn");
const searchInput      = document.getElementById("search-input");
const sortSelect       = document.getElementById("sort-select");
const goleadasList     = document.getElementById("goleadas-list");
const totalGoleadasEl  = document.getElementById("total-goleadas");
const loadingIndicator = document.getElementById("loading-indicator");
const emptyMsg         = document.getElementById("empty-msg");
const statusBar        = document.getElementById("status-bar");
const retryToast       = document.getElementById("retry-toast");
const retryToastText   = document.getElementById("retry-toast-text");
const test500Btn       = document.getElementById("test-500-btn");
const test429Btn       = document.getElementById("test-429-btn");

// ===== NAVEGACION ENTRE PANTALLAS =====
function mostrarPantalla(screenTarget, navTarget) {
  todasLasPantallas.forEach((s) => s.classList.add("hidden"));
  todosLosNavLinks.forEach((n) => n.classList.remove("active"));
  screenTarget.classList.remove("hidden");
  if (navTarget) navTarget.classList.add("active");
}

navDashboard.addEventListener("click", () => mostrarPantalla(screenDashboard, navDashboard));
navDetalle.addEventListener("click",   () => mostrarPantalla(screenDetalle, navDetalle));
navStats.addEventListener("click",     () => { mostrarPantalla(screenStats, navStats); renderStats(); });
navIA.addEventListener("click",        () => mostrarPantalla(screenIA, navIA));
navGrupos.addEventListener("click",    () => { mostrarPantalla(screenGrupos, navGrupos); renderGrupos(); });

// ===== TOAST BACKOFF =====
function mostrarRetryToast(attempt, delayMs, status) {
  let secondsLeft = Math.ceil(delayMs / 1000);
  retryToast.classList.remove("hidden");

  const motivo = status === 429
    ? "limite de peticiones alcanzado"
    : "error del servidor";

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

// ===== TIMESTAMP =====
function actualizarTimestamp(desdeCache) {
  const hora = new Date().toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
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

// ===== CARGA DE DATOS =====
async function cargarGoleadas() {
  loadingIndicator.classList.remove("hidden");
  emptyMsg.classList.add("hidden");
  statusBar.classList.add("hidden");
  goleadasList.innerHTML = "";

  let partidos = null;
  let equipos  = null;
  let usandoCacheGames = false;
  let usandoCacheTeams = false;
  let teamsFallaron    = false;

  // Paso 1: cargar partidos (bloqueante)
  try {
    partidos = await getGames(mostrarRetryToast);
    saveToCache("games", partidos);
    todosLosPartidos = partidos;
  } catch (err) {
    const cached = getFromCache("games");
    if (cached) {
      partidos = cached.data;
      todosLosPartidos = partidos;
      usandoCacheGames = true;
    } else {
      loadingIndicator.classList.add("hidden");
      emptyMsg.textContent = "No se pudieron cargar los partidos y no hay datos guardados localmente.";
      emptyMsg.classList.remove("hidden");
      return;
    }
  }

  // Paso 2: cargar equipos (no bloqueante)
  try {
    equipos = await getTeams(mostrarRetryToast);
    saveToCache("teams", equipos);
  } catch (err) {
    const cached = getFromCache("teams");
    if (cached) {
      equipos = cached.data;
      usandoCacheTeams = true;
    } else {
      equipos = null;
      teamsFallaron = true;
    }
  }

  const desdeCache = usandoCacheGames || usandoCacheTeams;

  if (desdeCache) {
    statusBar.textContent =
      "Mostrando datos guardados localmente (no actualizados). La conexion con el servidor fallo.";
    statusBar.classList.remove("hidden");
  }

  actualizarTimestamp(desdeCache);

  const goleadas    = obtenerGoleadas(partidos);
  goleadasCompletas = enriquecerConEquipos(goleadas, equipos);

  inicializarChat(goleadasCompletas);
  loadingIndicator.classList.add("hidden");
  aplicarFiltroYOrden();

  // Paso 3: si teams falló del todo, reintentar en background (Reto 2.2)
  if (teamsFallaron) {
    statusBar.textContent =
      "Nombres de equipos no disponibles. Reintentando en segundo plano...";
    statusBar.classList.remove("hidden");

    getTeamsBackground(
      mostrarRetryToast,
      (equiposRecuperados) => {
        saveToCache("teams", equiposRecuperados);
        goleadasCompletas = enriquecerConEquipos(goleadas, equiposRecuperados);
        inicializarChat(goleadasCompletas);
        aplicarFiltroYOrden();
        statusBar.classList.add("hidden");
        actualizarTimestamp(usandoCacheGames);
      }
    );
  }
}

// ===== FILTRO Y ORDEN — DASHBOARD =====
function aplicarFiltroYOrden() {
  const query    = searchInput.value.trim().toLowerCase();
  const criterio = sortSelect.value;

  let resultado = goleadasCompletas.filter((p) => {
    const localNombre     = (p.equipoLocal.name_en || "").toLowerCase();
    const visitanteNombre = (p.equipoVisitante.name_en || "").toLowerCase();
    return localNombre.includes(query) || visitanteNombre.includes(query);
  });

  if (criterio === "fecha") {
    resultado = [...resultado].sort((a, b) => new Date(a.local_date) - new Date(b.local_date));
  } else {
    resultado = [...resultado].sort((a, b) => b.diferencia - a.diferencia);
  }

  renderGoleadas(resultado);
}

// ===== RENDER DASHBOARD =====
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

  // Click en tarjeta → pantalla de detalle
  goleadasList.querySelectorAll(".goleada-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const partido = goleadasCompletas.find((p) => String(p.id) === String(id));
      if (partido) mostrarDetalle(partido);
    });
  });
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
    ? new Date(partido.local_date).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return `
    <li class="goleada-card" data-id="${partido.id}" style="cursor:pointer;">
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

// ===== PANTALLA 2: DETALLE DE PARTIDO =====
function mostrarDetalle(partido) {
  mostrarPantalla(screenDetalle, navDetalle);

  const local     = partido.equipoLocal;
  const visitante = partido.equipoVisitante;

  const fecha = partido.local_date
    ? new Date(partido.local_date).toLocaleDateString("es-CR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "Fecha no disponible";

  const goleadoresLocal     = parsearGoleadores(partido.home_scorers);
  const goleadoresVisitante = parsearGoleadores(partido.away_scorers);

  const renderEquipo = (equipo) =>
    equipo._esRespaldo
      ? `<span class="team-fallback">${equipo.name_en}</span>`
      : `
        <div class="detalle-equipo">
          ${equipo.flag ? `<img src="${equipo.flag}" alt="${equipo.name_en}" class="detalle-flag" />` : ""}
          <span class="detalle-nombre">${equipo.name_en}</span>
        </div>`;

  const renderGoleadores = (lista, equipoNombre) => {
    if (lista.length === 0) return `<p class="detalle-sin-data">Sin datos de goleadores</p>`;
    return lista.map((g) => `<div class="detalle-goleador">⚽ ${g}</div>`).join("");
  };

  document.getElementById("detalle-contenido").innerHTML = `
    <button id="detalle-volver-btn" class="btn-secondary" style="margin-bottom:1.5rem;">← Volver al dashboard</button>

    <div class="detalle-card">
      <div class="detalle-meta">
        <span class="detalle-grupo">Grupo ${partido.group || "N/A"}</span>
        <span class="detalle-fecha">${fecha}</span>
        ${partido.stadium_id ? `<span class="detalle-estadio">Estadio ID: ${partido.stadium_id}</span>` : ""}
      </div>

      <div class="detalle-marcador">
        ${renderEquipo(local)}
        <div class="detalle-score-box">
          <span class="detalle-score">${partido.home_score} - ${partido.away_score}</span>
          <span class="detalle-diff">+${partido.diferencia} goles de diferencia</span>
        </div>
        ${renderEquipo(visitante)}
      </div>

      <div class="detalle-goleadores-grid">
        <div class="detalle-goleadores-col">
          <h3>${local.name_en}</h3>
          ${renderGoleadores(goleadoresLocal, local.name_en)}
        </div>
        <div class="detalle-goleadores-col">
          <h3>${visitante.name_en}</h3>
          ${renderGoleadores(goleadoresVisitante, visitante.name_en)}
        </div>
      </div>
    </div>
  `;

  document.getElementById("detalle-volver-btn").addEventListener("click", () => {
    mostrarPantalla(screenDashboard, navDashboard);
  });
}

// ===== PANTALLA 3: ESTADÍSTICAS =====
function renderStats() {
  const contenedor = document.getElementById("stats-contenido");

  if (goleadasCompletas.length === 0) {
    contenedor.innerHTML = `<p class="empty-msg">Carga los datos primero desde el Dashboard.</p>`;
    return;
  }

  // Equipo con más goles marcados en goleadas
  const golesPorEquipo = {};
  goleadasCompletas.forEach((p) => {
    const local     = p.equipoLocal.name_en;
    const visitante = p.equipoVisitante.name_en;
    golesPorEquipo[local]     = (golesPorEquipo[local]     || 0) + Number(p.home_score);
    golesPorEquipo[visitante] = (golesPorEquipo[visitante] || 0) + Number(p.away_score);
  });

  const equipoMasGoleador = Object.entries(golesPorEquipo)
    .sort((a, b) => b[1] - a[1])[0];

  // Promedio de diferencia
  const promDif = (
    goleadasCompletas.reduce((acc, p) => acc + p.diferencia, 0) / goleadasCompletas.length
  ).toFixed(2);

  // Total de goles en goleadas
  const totalGoles = goleadasCompletas.reduce(
    (acc, p) => acc + Number(p.home_score) + Number(p.away_score), 0
  );

  // Goleador más frecuente
  const frecuencia = {};
  goleadasCompletas.forEach((p) => {
    [...parsearGoleadores(p.home_scorers), ...parsearGoleadores(p.away_scorers)].forEach((g) => {
      const nombre = g.replace(/\s*\d+['"]?\s*$/, "").trim();
      if (nombre) frecuencia[nombre] = (frecuencia[nombre] || 0) + 1;
    });
  });

  const goleadorTop = Object.entries(frecuencia).sort((a, b) => b[1] - a[1])[0];

  // Partidos por grupo
  const porGrupo = {};
  goleadasCompletas.forEach((p) => {
    const g = p.group || "N/A";
    porGrupo[g] = (porGrupo[g] || 0) + 1;
  });

  const gruposHTML = Object.entries(porGrupo)
    .sort((a, b) => b[1] - a[1])
    .map(([grupo, cantidad]) => `
      <div class="stat-grupo-bar">
        <span class="stat-grupo-label">Grupo ${grupo}</span>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width:${Math.min(100, (cantidad / goleadasCompletas.length) * 100 * 3)}%"></div>
        </div>
        <span class="stat-grupo-count">${cantidad}</span>
      </div>
    `).join("");

  contenedor.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Equipo más goleador</div>
        <div class="stat-value">${equipoMasGoleador ? equipoMasGoleador[0] : "N/A"}</div>
        <div class="stat-sub">${equipoMasGoleador ? equipoMasGoleador[1] + " goles en goleadas" : ""}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Promedio de diferencia</div>
        <div class="stat-value">${promDif}</div>
        <div class="stat-sub">goles por goleada</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total de goles</div>
        <div class="stat-value">${totalGoles}</div>
        <div class="stat-sub">en ${goleadasCompletas.length} goleadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Goleador más frecuente</div>
        <div class="stat-value">${goleadorTop ? goleadorTop[0] : "N/A"}</div>
        <div class="stat-sub">${goleadorTop ? goleadorTop[1] + " gol(es)" : "sin datos"}</div>
      </div>
    </div>

    <div class="stats-grupos">
      <h3>Goleadas por grupo</h3>
      <div class="stat-grupos-lista">${gruposHTML}</div>
    </div>
  `;
}

// ===== PANTALLA 5: RANKING POR GRUPOS =====
function renderGrupos() {
  const contenedor = document.getElementById("grupos-contenido");

  if (goleadasCompletas.length === 0) {
    contenedor.innerHTML = `<p class="empty-msg">Carga los datos primero desde el Dashboard.</p>`;
    return;
  }

  const porGrupo = {};
  goleadasCompletas.forEach((p) => {
    const g = p.group || "N/A";
    if (!porGrupo[g]) porGrupo[g] = [];
    porGrupo[g].push(p);
  });

  const grupos = Object.keys(porGrupo).sort();

  contenedor.innerHTML = grupos.map((grupo) => {
    const partidos = porGrupo[grupo];
    const totalGoles = partidos.reduce((acc, p) => acc + Number(p.home_score) + Number(p.away_score), 0);
    const maxDif = Math.max(...partidos.map((p) => p.diferencia));

    const filasHTML = partidos.map((p) => {
      const local     = p.equipoLocal;
      const visitante = p.equipoVisitante;

      const localHTML = local._esRespaldo
        ? `<span class="team-fallback">${local.name_en}</span>`
        : `${local.flag ? `<img src="${local.flag}" alt="${local.name_en}" style="width:18px;height:12px;object-fit:cover;border-radius:2px;vertical-align:middle;margin-right:4px;">` : ""}<span>${local.name_en}</span>`;

      const visitanteHTML = visitante._esRespaldo
        ? `<span class="team-fallback">${visitante.name_en}</span>`
        : `${visitante.flag ? `<img src="${visitante.flag}" alt="${visitante.name_en}" style="width:18px;height:12px;object-fit:cover;border-radius:2px;vertical-align:middle;margin-right:4px;">` : ""}<span>${visitante.name_en}</span>`;

      const fecha = p.local_date
        ? new Date(p.local_date).toLocaleDateString("es-CR", { day: "2-digit", month: "short" })
        : "";

      return `
        <tr class="grupo-fila" data-id="${p.id}" style="cursor:pointer;">
          <td>${localHTML}</td>
          <td class="grupo-score">${p.home_score} - ${p.away_score}</td>
          <td>${visitanteHTML}</td>
          <td><span class="goleada-diff">+${p.diferencia}</span></td>
          <td class="grupo-fecha">${fecha}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="grupo-seccion">
        <div class="grupo-header">
          <span class="grupo-titulo">Grupo ${grupo}</span>
          <div class="grupo-meta">
            <span class="grupo-badge">${partidos.length} goleada${partidos.length !== 1 ? "s" : ""}</span>
            <span class="grupo-badge-goles">${totalGoles} goles totales</span>
            <span class="grupo-badge-max">Mayor dif: +${maxDif}</span>
          </div>
        </div>
        <table class="grupo-tabla">
          <thead>
            <tr>
              <th>Local</th><th>Marcador</th><th>Visitante</th><th>Dif.</th><th>Fecha</th>
            </tr>
          </thead>
          <tbody>${filasHTML}</tbody>
        </table>
      </div>
    `;
  }).join("");

  // Click en fila → detalle
  contenedor.querySelectorAll(".grupo-fila").forEach((fila) => {
    fila.addEventListener("click", () => {
      const id = fila.dataset.id;
      const partido = goleadasCompletas.find((p) => String(p.id) === String(id));
      if (partido) mostrarDetalle(partido);
    });
  });
}

// ===== EVENTOS DASHBOARD =====
reloadBtn.addEventListener("click", () => cargarGoleadas());
searchInput.addEventListener("input", () => aplicarFiltroYOrden());
sortSelect.addEventListener("change", () => aplicarFiltroYOrden());

test500Btn.addEventListener("click", async () => {
  let attempt = 0;
  const tryFetch = async () => {
    const response = await fetch(`${BASE_PROXY}/test/500`);
    if (response.status === 500) {
      if (attempt < 4) {
        const delayMs = 1000 * Math.pow(2, attempt);
        mostrarRetryToast(attempt + 1, delayMs, 500);
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs));
        await tryFetch();
      } else {
        const cached = getFromCache("games");
        if (cached) {
          statusBar.textContent = "Mostrando datos guardados localmente. El servidor fallo tras 4 reintentos.";
          statusBar.classList.remove("hidden");
        }
      }
    }
  };
  await tryFetch();
});

test429Btn.addEventListener("click", async () => {
  let attempt = 0;
  const tryFetch = async () => {
    const response = await fetch(`${BASE_PROXY}/test/429`);
    if (response.status === 429) {
      if (attempt < 4) {
        const delayMs = 1000 * Math.pow(2, attempt);
        mostrarRetryToast(attempt + 1, delayMs, 429);
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs));
        await tryFetch();
      }
    }
  };
  await tryFetch();
});

// ===== AUTO-REFRESH =====
function iniciarAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => cargarGoleadas(), AUTO_REFRESH_MS);
}

// ===== INIT =====
async function init() {
  construirChatUI();
  inicializarChatPantallaCompleta();
  mostrarPantalla(screenDashboard, navDashboard);
  await cargarGoleadas();
  iniciarAutoRefresh();
}

init();