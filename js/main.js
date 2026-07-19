// js/main.js
// Orquestador principal. Unico archivo que toca el DOM.
// Maneja los 5 subproyectos via show/hide de secciones.

import { getGames, getTeams, getStadiums, getGroups, getTeamsBackground, ApiError, BASE_URL, BASE_DELAY_MS, MAX_RETRIES, sleep } from "./api.js";
import { saveToCache, getFromCache }                                         from "./storage.js";
import { obtenerGoleadas, enriquecerConEquipos as enriquecerGoleadas, parsearGoleadores } from "./goleadas.js";
import { obtenerPartidosDeEquipo, enriquecerConEstadios, contarCiudadesDistintas, construirMapaEstadios, enriquecerConEquipos as enriquecerRuta, buscarEquipo } from "./ruta.js";
import { extraerRegistrosGa, obtenerTopMenosGoleados, enriquecerConEquipos as enriquecerMuro, buscarProximoPartido, enriquecerConRivales } from "./muro.js";
import { contarPartidosPorEstadio, calcularAsistenciaPotencial, obtenerMaximoAsistencia, obtenerMaximoCapacidad } from "./estadios.js";
import { obtenerEmpates, agruparPorGrupo, enriquecerConEquipos as enriquecerEmpates, calcularTotalesPorGrupo } from "./empates.js";
import { inicializarChat, construirChatUI } from "./chat.js";

// ===== CONSTANTES =====
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// ===== ESTADO GLOBAL =====
let goleadasCompletas  = [];
let todosLosPartidos   = [];
let todosLosEquipos    = [];
let todosLosEstadios   = [];
let todosLosGrupos     = [];
let autoRefreshTimer   = null;
let contextoGlobalIA   = "";

// ===== REFERENCIAS DOM — NAVEGACION =====
const navGoleadas  = document.getElementById("nav-goleadas");
const navRuta      = document.getElementById("nav-ruta");
const navMuro      = document.getElementById("nav-muro");
const navAnalitica = document.getElementById("nav-analitica");
const navRadar     = document.getElementById("nav-radar");

const screenGoleadas  = document.getElementById("screen-goleadas");
const screenRuta      = document.getElementById("screen-ruta");
const screenMuro      = document.getElementById("screen-muro");
const screenAnalitica = document.getElementById("screen-analitica");
const screenRadar     = document.getElementById("screen-radar");
const screenDetalle   = document.getElementById("screen-detalle");

const todasLasPantallas = [screenGoleadas, screenDetalle, screenRuta, screenMuro, screenAnalitica, screenRadar];
const todosLosNavLinks  = [navGoleadas, navRuta, navMuro, navAnalitica, navRadar];

// ===== REFERENCIAS DOM — ESTADO GLOBAL NAVBAR =====
const lastUpdateEl = document.getElementById("last-update");
const dataBadgeEl  = document.getElementById("data-badge");

// ===== REFERENCIAS DOM — DASHBOARD GOLEADAS =====
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

// ===== NAVEGACION =====
function mostrarPantalla(screenTarget, navTarget) {
  todasLasPantallas.forEach((s) => s.classList.add("hidden"));
  todosLosNavLinks.forEach((n) => n.classList.remove("active"));
  screenTarget.classList.remove("hidden");
  if (navTarget) navTarget.classList.add("active");
}

navGoleadas.addEventListener("click",  () => mostrarPantalla(screenGoleadas, navGoleadas));
navRuta.addEventListener("click",      () => { mostrarPantalla(screenRuta, navRuta); inicializarRuta(); });
navMuro.addEventListener("click",      () => { mostrarPantalla(screenMuro, navMuro); cargarMuro(); });
navAnalitica.addEventListener("click", () => { mostrarPantalla(screenAnalitica, navAnalitica); cargarAnalitica(); });
navRadar.addEventListener("click",     () => { mostrarPantalla(screenRadar, navRadar); cargarRadar(); });

// ===== TOAST BACKOFF (universal) =====
function mostrarRetryToast(attempt, delayMs, status) {
  let secondsLeft = Math.ceil(delayMs / 1000);
  retryToast.classList.remove("hidden");

  const motivo = status === 429 ? "limite de peticiones" : "error del servidor";
  retryToastText.textContent = `Reintentando (${motivo})... intento ${attempt}, proximo en ${secondsLeft}s`;

  const intervalId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      clearInterval(intervalId);
      retryToast.classList.add("hidden");
      return;
    }
    retryToastText.textContent = `Reintentando (${motivo})... intento ${attempt}, proximo en ${secondsLeft}s`;
  }, 1000);
}

// ===== TIMESTAMP NAVBAR =====
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

// ===== STATUS BAR HELPER =====
function mostrarStatusBar(texto) {
  statusBar.textContent = texto;
  statusBar.classList.remove("hidden");
}

function ocultarStatusBar() {
  statusBar.classList.add("hidden");
}

// ===== CONTEXTO IA GLOBAL =====
function actualizarContextoIA() {
  const partes = [];

  if (goleadasCompletas.length > 0) {
    const resumenGoleadas = goleadasCompletas.slice(0, 10).map((p, i) => {
      const local     = p.equipoLocal?.name_en     || p.home_team_id;
      const visitante = p.equipoVisitante?.name_en || p.away_team_id;
      return `${i + 1}. ${local} ${p.home_score}-${p.away_score} ${visitante} (dif: ${p.diferencia}, grupo: ${p.group || "N/A"})`;
    }).join("\n");
    partes.push(`GOLEADAS DEL TORNEO:\n${resumenGoleadas}`);
  }

  if (todosLosEstadios.length > 0) {
    const resumenEstadios = todosLosEstadios.slice(0, 5).map((e) =>
      `${e.name} — ${e.city_en}, ${e.country_en} (aforo: ${Number(e.capacity).toLocaleString()})`
    ).join("\n");
    partes.push(`ESTADIOS:\n${resumenEstadios}`);
  }

  contextoGlobalIA = partes.join("\n\n");
  inicializarChat(contextoGlobalIA);
}

// ======================================================================
// SUBPROYECTO 1 — RASTREADOR DE GOLEADAS
// ======================================================================

async function cargarGoleadas() {
  loadingIndicator.classList.remove("hidden");
  emptyMsg.classList.add("hidden");
  ocultarStatusBar();
  goleadasList.innerHTML = "";

  let partidos          = null;
  let equipos           = null;
  let usandoCacheGames  = false;
  let usandoCacheTeams  = false;
  let teamsFallaron     = false;

  // Paso 1: partidos (bloqueante)
  try {
    partidos = await getGames(mostrarRetryToast);
    saveToCache("games", partidos);
    todosLosPartidos = partidos;
  } catch {
    const cached = getFromCache("games");
    if (cached) {
      partidos         = cached.data;
      todosLosPartidos = partidos;
      usandoCacheGames = true;
    } else {
      loadingIndicator.classList.add("hidden");
      emptyMsg.textContent = "No se pudieron cargar los partidos y no hay datos guardados localmente.";
      emptyMsg.classList.remove("hidden");
      return;
    }
  }

  // Paso 2: equipos (no bloqueante)
  try {
    equipos = await getTeams(mostrarRetryToast);
    saveToCache("teams", equipos);
    todosLosEquipos = equipos;
  } catch {
    const cached = getFromCache("teams");
    if (cached) {
      equipos          = cached.data;
      todosLosEquipos  = equipos;
      usandoCacheTeams = true;
    } else {
      equipos       = null;
      teamsFallaron = true;
    }
  }

  const desdeCache = usandoCacheGames || usandoCacheTeams;
  if (desdeCache) {
    mostrarStatusBar("Mostrando datos guardados localmente. La conexion con el servidor fallo.");
  }

  actualizarTimestamp(desdeCache);

  const goleadas    = obtenerGoleadas(partidos);
  goleadasCompletas = enriquecerGoleadas(goleadas, equipos);

  actualizarContextoIA();
  loadingIndicator.classList.add("hidden");
  aplicarFiltroYOrden();

  // Paso 3: si teams fallo del todo, reintentar en background (Reto 2.2)
  if (teamsFallaron) {
    mostrarStatusBar("Nombres de equipos no disponibles. Reintentando en segundo plano...");
    getTeamsBackground(
      mostrarRetryToast,
      (equiposRecuperados) => {
        saveToCache("teams", equiposRecuperados);
        todosLosEquipos   = equiposRecuperados;
        goleadasCompletas = enriquecerGoleadas(goleadas, equiposRecuperados);
        actualizarContextoIA();
        aplicarFiltroYOrden();
        ocultarStatusBar();
        actualizarTimestamp(usandoCacheGames);
      }
    );
  }
}

function aplicarFiltroYOrden() {
  const query    = searchInput.value.trim().toLowerCase();
  const criterio = sortSelect.value;

  let resultado = goleadasCompletas.filter((p) => {
    const localNombre     = (p.equipoLocal?.name_en     || "").toLowerCase();
    const visitanteNombre = (p.equipoVisitante?.name_en || "").toLowerCase();
    return localNombre.includes(query) || visitanteNombre.includes(query);
  });

  if (criterio === "fecha") {
    resultado = [...resultado].sort((a, b) => new Date(a.local_date) - new Date(b.local_date));
  } else {
    resultado = [...resultado].sort((a, b) => b.diferencia - a.diferencia);
  }

  renderGoleadas(resultado);
}

function renderGoleadas(goleadas) {
  totalGoleadasEl.innerHTML = `<strong>${goleadas.length}</strong>`;

  if (goleadas.length === 0) {
    emptyMsg.textContent = "No se encontraron goleadas.";
    emptyMsg.classList.remove("hidden");
    goleadasList.innerHTML = "";
    return;
  }

  emptyMsg.classList.add("hidden");
  goleadasList.innerHTML = goleadas.map((p, i) => crearTarjetaGoleadaHTML(p, i + 1)).join("");

  goleadasList.querySelectorAll(".goleada-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id      = card.dataset.id;
      const partido = goleadasCompletas.find((p) => String(p.id) === String(id));
      if (partido) mostrarDetalle(partido);
    });
  });
}

function crearTarjetaGoleadaHTML(partido, rank) {
  const local     = partido.equipoLocal;
  const visitante = partido.equipoVisitante;

  const localHTML = local._esRespaldo
    ? `<div class="goleada-team"><span class="team-fallback">${local.name_en}</span></div>`
    : `<div class="goleada-team">${local.flag ? `<img src="${local.flag}" alt="${local.name_en}" />` : ""}<span>${local.name_en}</span></div>`;

  const visitanteHTML = visitante._esRespaldo
    ? `<div class="goleada-team"><span class="team-fallback">${visitante.name_en}</span></div>`
    : `<div class="goleada-team">${visitante.flag ? `<img src="${visitante.flag}" alt="${visitante.name_en}" />` : ""}<span>${visitante.name_en}</span></div>`;

  const fecha = partido.local_date
    ? new Date(partido.local_date).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  const grupo = partido.group ? `<span class="chip chip--ghost">Grupo ${partido.group}</span>` : "";

  return `
    <li class="goleada-card" data-id="${partido.id}">
      <div class="goleada-rank">
        <span class="goleada-rank-num">${String(rank).padStart(2, "0")}</span>
      </div>
      <div class="goleada-teams">
        ${localHTML}
        <span class="goleada-sep">vs</span>
        ${visitanteHTML}
        ${grupo}
      </div>
      <div class="goleada-info">
        <span class="goleada-score">${partido.home_score} - ${partido.away_score}</span>
        <div class="goleada-meta">
          <span class="goleada-diff">+${partido.diferencia}</span>
          ${fecha ? `<span class="goleada-date">${fecha}</span>` : ""}
        </div>
      </div>
    </li>
  `;
}

// ===== DETALLE DE PARTIDO =====
function mostrarDetalle(partido) {
  mostrarPantalla(screenDetalle, null);

  const local     = partido.equipoLocal;
  const visitante = partido.equipoVisitante;

  const fecha = partido.local_date
    ? new Date(partido.local_date).toLocaleDateString("es-CR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
      })
    : "Fecha no disponible";

  const goleadoresLocal     = parsearGoleadores(partido.home_scorers);
  const goleadoresVisitante = parsearGoleadores(partido.away_scorers);

  const renderEquipoDetalle = (equipo) =>
    equipo._esRespaldo
      ? `<div class="detalle-equipo"><span class="team-fallback">${equipo.name_en}</span></div>`
      : `<div class="detalle-equipo">
           ${equipo.flag ? `<img src="${equipo.flag}" alt="${equipo.name_en}" class="detalle-flag" />` : ""}
           <span class="detalle-nombre">${equipo.name_en}</span>
         </div>`;

  const renderGoleadoresDetalle = (lista) => {
    if (lista.length === 0) return `<p class="detalle-sin-data">Sin datos de goleadores</p>`;
    return lista.map((g) => `<div class="detalle-goleador">${g}</div>`).join("");
  };

  document.getElementById("detalle-contenido").innerHTML = `
    <button id="detalle-volver-btn" class="btn-secondary" style="margin-bottom:1.5rem;">Volver a Goleadas</button>
    <div class="detalle-card">
      <div class="detalle-meta">
        <span class="detalle-grupo">Grupo ${partido.group || "N/A"}</span>
        <span class="detalle-fecha">${fecha}</span>
        ${partido.stadium_id ? `<span class="detalle-estadio">Estadio ID: ${partido.stadium_id}</span>` : ""}
      </div>
      <div class="detalle-marcador">
        ${renderEquipoDetalle(local)}
        <div class="detalle-score-box">
          <span class="detalle-score">${partido.home_score} - ${partido.away_score}</span>
          <span class="detalle-diff">+${partido.diferencia} goles de diferencia</span>
        </div>
        ${renderEquipoDetalle(visitante)}
      </div>
      <div class="detalle-goleadores-grid">
        <div class="detalle-goleadores-col">
          <h3>${local.name_en}</h3>
          ${renderGoleadoresDetalle(goleadoresLocal)}
        </div>
        <div class="detalle-goleadores-col">
          <h3>${visitante.name_en}</h3>
          ${renderGoleadoresDetalle(goleadoresVisitante)}
        </div>
      </div>
    </div>
  `;

  document.getElementById("detalle-volver-btn").addEventListener("click", () => {
    mostrarPantalla(screenGoleadas, navGoleadas);
  });
}

// ===== EVENTOS GOLEADAS =====
reloadBtn.addEventListener("click",   () => cargarGoleadas());
searchInput.addEventListener("input", () => aplicarFiltroYOrden());
sortSelect.addEventListener("change", () => aplicarFiltroYOrden());

test500Btn.addEventListener("click", async () => {
  let attempt = 0;
  const tryFetch = async () => {
    const response = await fetch(`${BASE_URL}/test/500`);
    if (response.status === 500) {
      if (attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        mostrarRetryToast(attempt + 1, delayMs, 500);
        attempt++;
        await sleep(delayMs);
        await tryFetch();
      } else {
        const cached = getFromCache("games");
        if (cached) {
          mostrarStatusBar("Mostrando datos guardados localmente. El servidor fallo tras 4 reintentos.");
        }
      }
    }
  };
  await tryFetch();
});

test429Btn.addEventListener("click", async () => {
  let attempt = 0;
  const tryFetch = async () => {
    const response = await fetch(`${BASE_URL}/test/429`);
    if (response.status === 429) {
      if (attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        mostrarRetryToast(attempt + 1, delayMs, 429);
        attempt++;
        await sleep(delayMs);
        await tryFetch();
      }
    }
  };
  await tryFetch();
});

// ======================================================================
// SUBPROYECTO 2 — LA RUTA DEL CAMPEON
// ======================================================================

let rutaPartidos   = [];
let rutaEstadios   = [];
let rutaEquipos    = [];
let rutaInicializada = false;

async function inicializarRuta() {
  // Los equipos y partidos pueden ya estar en memoria de Goleadas
  // Si no, los cargamos aqui
  const contenedor = document.getElementById("ruta-contenido");

  if (!rutaInicializada) {
    // Cargar selector de equipos
    await cargarSelectorEquipos();
    rutaInicializada = true;
  }
}

async function cargarSelectorEquipos() {
  const selectEl  = document.getElementById("ruta-equipo-select");
  const loadingEl = document.getElementById("ruta-loading-equipos");

  loadingEl.classList.remove("hidden");

  let equipos = todosLosEquipos;

  if (!equipos || equipos.length === 0) {
    try {
      equipos = await getTeams(mostrarRetryToast);
      saveToCache("teams", equipos);
      todosLosEquipos = equipos;
      rutaEquipos     = equipos;
    } catch {
      const cached = getFromCache("teams");
      equipos       = cached ? cached.data : [];
      rutaEquipos   = equipos;
    }
  } else {
    rutaEquipos = equipos;
  }

  loadingEl.classList.add("hidden");

  // Poblar select
  selectEl.innerHTML = `<option value="">Selecciona un equipo...</option>` +
    [...equipos]
      .sort((a, b) => a.name_en.localeCompare(b.name_en))
      .map((e) => `<option value="${e.id}">${e.name_en}</option>`)
      .join("");
}

async function cargarItinerario(teamId) {
  const contenedor      = document.getElementById("ruta-itinerario");
  const ciudadesEl      = document.getElementById("ruta-ciudades");
  const itinerarioLoad  = document.getElementById("ruta-itinerario-loading");

  contenedor.innerHTML     = "";
  ciudadesEl.textContent   = "";
  itinerarioLoad.classList.remove("hidden");

  // Paso 1: partidos
  let partidos = todosLosPartidos;
  if (!partidos || partidos.length === 0) {
    try {
      partidos         = await getGames(mostrarRetryToast);
      saveToCache("games", partidos);
      todosLosPartidos = partidos;
    } catch {
      const cached     = getFromCache("games");
      partidos         = cached ? cached.data : [];
      todosLosPartidos = partidos;
    }
  }

  const partidosEquipo = obtenerPartidosDeEquipo(partidos, teamId);
  const equipoElegido  = rutaEquipos.find((e) => String(e.id) === String(teamId));

  // Enriquecer con equipos para mostrar rival
  const partidosConEquipos = enriquecerRuta(partidosEquipo, rutaEquipos);

  if (partidosEquipo.length === 0) {
    itinerarioLoad.classList.add("hidden");
    contenedor.innerHTML = `<p class="empty-msg">Este equipo no tiene partidos registrados.</p>`;
    return;
  }

  // Paso 2: estadios (Reto de Resiliencia 2.1)
  // Si falla, las tarjetas ya renderizadas NO desaparecen
  let estadiosMap   = {};
  let estadiosFallo = false;

  try {
    let estadios = todosLosEstadios;
    if (!estadios || estadios.length === 0) {
      estadios         = await getStadiums(mostrarRetryToast);
      saveToCache("stadiums", estadios);
      todosLosEstadios = estadios;
      actualizarContextoIA();
    }
    estadiosMap = construirMapaEstadios(estadios);
  } catch {
    const cached = getFromCache("stadiums");
    if (cached) {
      estadiosMap = construirMapaEstadios(cached.data);
    } else {
      estadiosFallo = true;
    }
  }

  itinerarioLoad.classList.add("hidden");

  // Renderizar tarjetas con lo que hay
  const partidosEnriquecidos = enriquecerConEstadios(partidosConEquipos, estadiosMap);
  const ciudadesDistintas    = contarCiudadesDistintas(partidosEnriquecidos);

  ciudadesEl.textContent = `${ciudadesDistintas} ciudad${ciudadesDistintas !== 1 ? "es" : ""} distinta${ciudadesDistintas !== 1 ? "s" : ""}`;

  contenedor.innerHTML = partidosEnriquecidos.map((p, i) =>
    crearTarjetaRutaHTML(p, i + 1, equipoElegido)
  ).join("");

  // Si estadios fallo, reintentar en background sin destruir tarjetas ya renderizadas
  if (estadiosFallo) {
    mostrarStatusBar("Datos de estadios no disponibles. Reintentando en segundo plano...");
    reintentarEstadiosBackground(partidosConEquipos, contenedor, ciudadesEl, equipoElegido);
  }
}

async function reintentarEstadiosBackground(partidosConEquipos, contenedor, ciudadesEl, equipoElegido) {
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    try {
      const estadios   = await getStadiums(mostrarRetryToast);
      saveToCache("stadiums", estadios);
      todosLosEstadios = estadios;
      actualizarContextoIA();

      const estadiosMap          = construirMapaEstadios(estadios);
      const partidosEnriquecidos = enriquecerConEstadios(partidosConEquipos, estadiosMap);
      const ciudadesDistintas    = contarCiudadesDistintas(partidosEnriquecidos);

      ciudadesEl.textContent = `${ciudadesDistintas} ciudad${ciudadesDistintas !== 1 ? "es" : ""} distinta${ciudadesDistintas !== 1 ? "s" : ""}`;
      contenedor.innerHTML   = partidosEnriquecidos.map((p, i) =>
        crearTarjetaRutaHTML(p, i + 1, equipoElegido)
      ).join("");

      ocultarStatusBar();
      return;
    } catch {
      // continuar reintentando
    }
    attempt++;
  }
  mostrarStatusBar("No se pudieron cargar los estadios. Mostrando partidos sin detalle de recinto.");
}

function crearTarjetaRutaHTML(partido, numero, equipoElegido) {
  const esLocal       = String(partido.home_team_id) === String(equipoElegido?.id);
  const rival         = esLocal ? partido.equipoVisitante : partido.equipoLocal;
  const estadio       = partido.estadio;

  const fecha = partido.local_date
    ? new Date(partido.local_date).toLocaleDateString("es-CR", {
        weekday: "short", day: "2-digit", month: "short", year: "numeric",
      })
    : "Fecha por confirmar";

  const finLabel = (typeof partido.finished === "string"
    ? partido.finished.toUpperCase() === "TRUE"
    : partido.finished)
    ? `<span class="ruta-badge-finalizado">Finalizado</span>`
    : `<span class="ruta-badge-pendiente">Pendiente</span>`;

  const scoreHTML = (typeof partido.finished === "string"
    ? partido.finished.toUpperCase() === "TRUE"
    : partido.finished)
    ? `<span class="ruta-score">${partido.home_score} - ${partido.away_score}</span>`
    : `<span class="ruta-score-pendiente">Por jugar</span>`;

  const rivalHTML = rival._esRespaldo
    ? `<span class="team-fallback">${rival.name_en}</span>`
    : `${rival.flag ? `<img src="${rival.flag}" alt="${rival.name_en}" class="ruta-flag" />` : ""}<span>${rival.name_en}</span>`;

  const estadioHTML = estadio._sinEstadio
    ? `<span class="ruta-estadio-no-disp">Estadio no disponible</span>`
    : `<strong>${estadio.name_en}</strong> — ${estadio.city_en}, ${estadio.country_en}
       ${estadio.capacity ? `<span class="ruta-aforo">Aforo: ${Number(estadio.capacity).toLocaleString()}</span>` : ""}`;

  return `
    <div class="ruta-card">
      <div class="ruta-card-numero">${numero}</div>
      <div class="ruta-card-body">
        <div class="ruta-card-header">
          <div class="ruta-rival">
            <span class="ruta-rol">${esLocal ? "Local vs" : "Visitante vs"}</span>
            <div class="ruta-rival-equipo">${rivalHTML}</div>
          </div>
          <div class="ruta-card-score">
            ${scoreHTML}
            ${finLabel}
          </div>
        </div>
        <div class="ruta-card-meta">
          <span class="ruta-fecha">${fecha}</span>
          <span class="ruta-grupo">Grupo ${partido.group || "N/A"} — Jornada ${partido.matchday || "N/A"}</span>
        </div>
        <div class="ruta-estadio-info">${estadioHTML}</div>
      </div>
    </div>
  `;
}

// Eventos Ruta del Campeon
document.getElementById("ruta-equipo-select").addEventListener("change", async (e) => {
  const teamId = e.target.value;
  if (!teamId) {
    document.getElementById("ruta-itinerario").innerHTML = "";
    document.getElementById("ruta-ciudades").textContent = "";
    return;
  }
  await cargarItinerario(teamId);
});

// ======================================================================
// SUBPROYECTO 3 — EL MURO
// ======================================================================

let muroYaCargado = false;

async function cargarMuro() {
  if (muroYaCargado) return;

  const contenedor = document.getElementById("muro-contenido");
  const loadingEl  = document.getElementById("muro-loading");

  contenedor.innerHTML = "";
  loadingEl.classList.remove("hidden");

  let grupos  = [];
  let equipos = todosLosEquipos;
  let partidos = todosLosPartidos;

  // Cargar grupos
  try {
    grupos = await getGroups(mostrarRetryToast);
    saveToCache("groups", grupos);
    todosLosGrupos = grupos;
  } catch {
    const cached = getFromCache("groups");
    if (cached) {
      grupos         = cached.data;
      todosLosGrupos = grupos;
      mostrarStatusBar("Datos de grupos desde cache local.");
    } else {
      loadingEl.classList.add("hidden");
      contenedor.innerHTML = `<p class="empty-msg">No se pudieron cargar los datos de grupos.</p>`;
      return;
    }
  }

  // Cargar equipos si no estan en memoria
  if (!equipos || equipos.length === 0) {
    try {
      equipos         = await getTeams(mostrarRetryToast);
      saveToCache("teams", equipos);
      todosLosEquipos = equipos;
    } catch {
      const cached    = getFromCache("teams");
      equipos         = cached ? cached.data : [];
      todosLosEquipos = equipos;
    }
  }

  // Cargar partidos si no estan en memoria
  if (!partidos || partidos.length === 0) {
    try {
      partidos         = await getGames(mostrarRetryToast);
      saveToCache("games", partidos);
      todosLosPartidos = partidos;
    } catch {
      const cached     = getFromCache("games");
      partidos         = cached ? cached.data : [];
      todosLosPartidos = partidos;
    }
  }

  // Calcular top 5
  const registros  = extraerRegistrosGa(grupos);
  const top5raw    = obtenerTopMenosGoleados(registros, 5);
  const top5       = enriquecerMuro(top5raw, equipos);

  // Buscar proximo rival equipo por equipo (Reto de Resiliencia 2.3)
  // Si falla para uno, ese muestra "Proximo rival no disponible"
  const rivalData = await Promise.allSettled(
    top5.map(async (entrada) => {
      try {
        const proximoPartido = buscarProximoPartido(partidos, entrada.team_id);
        return { team_id: entrada.team_id, partido: proximoPartido, error: false };
      } catch {
        return { team_id: entrada.team_id, partido: null, error: true };
      }
    })
  );

  const rivalDataNormalizado = rivalData.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : { team_id: result.reason?.team_id || null, partido: null, error: true }
  );

  const top5Final = enriquecerConRivales(top5, rivalDataNormalizado, equipos);

  loadingEl.classList.add("hidden");
  renderMuro(top5Final, contenedor);
  muroYaCargado = true;
}

function renderMuro(top5, contenedor) {
  if (top5.length === 0) {
    contenedor.innerHTML = `<p class="empty-msg">No hay datos de grupos disponibles.</p>`;
    return;
  }

  contenedor.innerHTML = top5.map((entrada, i) => {
    const flagHTML = entrada.flag
      ? `<img src="${entrada.flag}" alt="${entrada.name_en}" class="muro-flag" />`
      : "";

    let rivalHTML;
    if (entrada.proximoRivalError) {
      rivalHTML = `<span class="muro-rival-no-disp">Proximo rival no disponible</span>`;
    } else if (!entrada.proximoRival) {
      rivalHTML = `<span class="muro-rival-sin-datos">Sin proximos partidos</span>`;
    } else {
      const r          = entrada.proximoRival;
      const rivalFlag  = r.flag ? `<img src="${r.flag}" alt="${r.name_en}" class="muro-rival-flag" />` : "";
      const fechaRival = r.local_date
        ? new Date(r.local_date).toLocaleDateString("es-CR", { day: "2-digit", month: "short" })
        : "";
      rivalHTML = `
        <div class="muro-rival-equipo">
          ${rivalFlag}
          <span>${r.name_en}</span>
          ${fechaRival ? `<span class="muro-rival-fecha">${fechaRival}</span>` : ""}
        </div>
      `;
    }

    return `
      <div class="muro-card">
        <div class="muro-rank">
          <span class="muro-rank-num">${i + 1}</span>
        </div>
        <div class="muro-equipo">
          ${flagHTML}
          <div class="muro-equipo-info">
            <span class="muro-nombre">${entrada.name_en}</span>
            <span class="muro-ga-badge">${entrada.ga} GC</span>
          </div>
        </div>
        <div class="muro-proximo">
          <span class="muro-proximo-label">Proximo partido</span>
          ${rivalHTML}
        </div>
      </div>
    `;
  }).join("");
}

// ======================================================================
// SUBPROYECTO 4 — ANALITICA DE ESTADIOS
// ======================================================================

let analiticaYaCargada = false;

async function cargarAnalitica() {
  if (analiticaYaCargada) return;

  const contenedor = document.getElementById("analitica-contenido");
  const loadingEl  = document.getElementById("analitica-loading");

  contenedor.innerHTML = "";
  loadingEl.classList.remove("hidden");

  // Paso 1: estadios (si fallan, abortar)
  let estadios = todosLosEstadios;
  if (!estadios || estadios.length === 0) {
    try {
      estadios         = await getStadiums(mostrarRetryToast);
      saveToCache("stadiums", estadios);
      todosLosEstadios = estadios;
      actualizarContextoIA();
    } catch {
      const cached = getFromCache("stadiums");
      if (cached) {
        estadios         = cached.data;
        todosLosEstadios = estadios;
        mostrarStatusBar("Datos de estadios desde cache local.");
      } else {
        loadingEl.classList.add("hidden");
        contenedor.innerHTML = `<p class="empty-msg">No se pudieron cargar los estadios.</p>`;
        return;
      }
    }
  }

  // Renderizar barras de estadios con partidos = 0 mientras carga partidos
  // (Reto de Resiliencia 2.4 — las barras no se destruyen si partidos falla)
  const estadiosBase = calcularAsistenciaPotencial(estadios, {});
  renderAnalitica(estadiosBase, contenedor, true);

  // Paso 2: partidos
  let partidos = todosLosPartidos;
  if (!partidos || partidos.length === 0) {
    try {
      partidos         = await getGames(mostrarRetryToast);
      saveToCache("games", partidos);
      todosLosPartidos = partidos;
    } catch {
      const cached = getFromCache("games");
      if (cached) {
        partidos         = cached.data;
        todosLosPartidos = partidos;
        mostrarStatusBar("Datos de partidos desde cache local.");
      } else {
        // Partidos fallaron — dejar grafica en estado de espera sin destruir estadios
        loadingEl.classList.add("hidden");
        const estadiosFinal = calcularAsistenciaPotencial(estadios, {});
        renderAnalitica(estadiosFinal, contenedor, false, true);
        reintentarPartidosAnaliticaBackground(estadios, contenedor);
        return;
      }
    }
  }

  loadingEl.classList.add("hidden");
  const conteo         = contarPartidosPorEstadio(partidos);
  const estadiosFinal  = calcularAsistenciaPotencial(estadios, conteo);
  renderAnalitica(estadiosFinal, contenedor, false, false);
  analiticaYaCargada = true;
}

async function reintentarPartidosAnaliticaBackground(estadios, contenedor) {
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    try {
      mostrarStatusBar(`Reintentando carga de partidos... intento ${attempt + 1}`);
      const partidos   = await getGames(mostrarRetryToast);
      saveToCache("games", partidos);
      todosLosPartidos = partidos;

      const conteo        = contarPartidosPorEstadio(partidos);
      const estadiosFinal = calcularAsistenciaPotencial(estadios, conteo);
      renderAnalitica(estadiosFinal, contenedor, false, false);
      ocultarStatusBar();
      analiticaYaCargada = true;
      return;
    } catch {
      // continuar
    }
    attempt++;
  }
  mostrarStatusBar("No se pudieron cargar los partidos. La grafica muestra solo capacidades.");
}

function renderAnalitica(estadios, contenedor, enEspera = false, partidosFallaron = false) {
  if (estadios.length === 0) {
    contenedor.innerHTML = `<p class="empty-msg">No hay datos de estadios disponibles.</p>`;
    return;
  }

  const maxAsistencia = obtenerMaximoAsistencia(estadios);
  const maxCapacidad  = obtenerMaximoCapacidad(estadios);

  const estadoBanner = enEspera
    ? `<div class="analitica-espera">Cargando datos de partidos...</div>`
    : partidosFallaron
      ? `<div class="analitica-espera analitica-espera--error">Esperando datos de partidos (reintentando en segundo plano)</div>`
      : "";

  const barrasHTML = estadios.map((e) => {
    const pctAsistencia = maxAsistencia > 0 ? (e.asistenciaPotencial / maxAsistencia) * 100 : 0;
    const pctCapacidad  = maxCapacidad  > 0 ? (Number(e.capacity)       / maxCapacidad)  * 100 : 0;

    return `
      <div class="analitica-fila">
        <div class="analitica-nombre" title="${e.name_en}">${e.name_en}</div>
        <div class="analitica-barras">
          <div class="analitica-barra-wrap" title="Capacidad: ${Number(e.capacity).toLocaleString()}">
            <div class="analitica-barra analitica-barra--capacidad" style="width:${pctCapacidad.toFixed(1)}%"></div>
            <span class="analitica-barra-label">${Number(e.capacity).toLocaleString()}</span>
          </div>
          <div class="analitica-barra-wrap" title="Asistencia potencial: ${e.asistenciaPotencial.toLocaleString()}">
            <div class="analitica-barra analitica-barra--asistencia" style="width:${pctAsistencia.toFixed(1)}%"></div>
            <span class="analitica-barra-label">${e.partidosAlbergados} partidos / ${e.asistenciaPotencial > 0 ? e.asistenciaPotencial.toLocaleString() : "sin datos"}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  contenedor.innerHTML = `
    ${estadoBanner}
    <div class="analitica-leyenda">
      <span class="analitica-leyenda-item analitica-leyenda-item--capacidad">Capacidad</span>
      <span class="analitica-leyenda-item analitica-leyenda-item--asistencia">Asistencia potencial</span>
    </div>
    <div class="analitica-grafica">${barrasHTML}</div>
  `;
}

// ======================================================================
// SUBPROYECTO 5 — RADAR DE EMPATES
// ======================================================================

let radarYaCargado = false;

async function cargarRadar() {
  if (radarYaCargado) return;

  const contenedor = document.getElementById("radar-contenido");
  const loadingEl  = document.getElementById("radar-loading");

  contenedor.innerHTML = "";
  loadingEl.classList.remove("hidden");

  let partidos = todosLosPartidos;
  let equipos  = todosLosEquipos;

  // Cargar partidos si no estan en memoria
  if (!partidos || partidos.length === 0) {
    try {
      partidos         = await getGames(mostrarRetryToast);
      saveToCache("games", partidos);
      todosLosPartidos = partidos;
    } catch {
      const cached = getFromCache("games");
      if (cached) {
        partidos         = cached.data;
        todosLosPartidos = partidos;
        mostrarStatusBar("Datos de partidos desde cache local.");
      } else {
        loadingEl.classList.add("hidden");
        contenedor.innerHTML = `<p class="empty-msg">No se pudieron cargar los partidos.</p>`;
        return;
      }
    }
  }

  // Cargar equipos si no estan en memoria
  if (!equipos || equipos.length === 0) {
    try {
      equipos         = await getTeams(mostrarRetryToast);
      saveToCache("teams", equipos);
      todosLosEquipos = equipos;
    } catch {
      const cached    = getFromCache("teams");
      equipos         = cached ? cached.data : [];
      todosLosEquipos = equipos;
    }
  }

  // Calcular empates y agrupar
  const empates    = obtenerEmpates(partidos);
  const agrupado   = agruparPorGrupo(empates);
  const grupos     = Object.keys(agrupado).sort();

  loadingEl.classList.add("hidden");

  if (grupos.length === 0) {
    contenedor.innerHTML = `<p class="empty-msg">No hay empates registrados en el torneo.</p>`;
    return;
  }

  // Renderizar grupo por grupo (Reto de Resiliencia 2.5)
  // Cada grupo se renderiza independientemente
  contenedor.innerHTML = "";

  for (const grupo of grupos) {
    const empatesGrupo = agrupado[grupo];

    // Crear contenedor del grupo inmediatamente
    const grupoEl = document.createElement("div");
    grupoEl.className = "radar-grupo";
    grupoEl.id        = `radar-grupo-${grupo}`;
    contenedor.appendChild(grupoEl);

    try {
      const empatesEnriquecidos = enriquecerEmpates(empatesGrupo, equipos);
      renderGrupoRadar(grupoEl, grupo, empatesEnriquecidos);
    } catch {
      // Si falla para este grupo, mostrar error parcial sin afectar los otros
      grupoEl.innerHTML = `
        <div class="radar-grupo-header">
          <span class="radar-grupo-titulo">Grupo ${grupo}</span>
        </div>
        <div class="radar-grupo-error">Error al cargar este grupo. Los demas grupos siguen disponibles.</div>
      `;
    }
  }

  radarYaCargado = true;
}

function renderGrupoRadar(grupoEl, grupo, empates) {
  const totalEmpates = empates.length;

  const celdasHTML = empates.map((p) => {
    const local     = p.equipoLocal;
    const visitante = p.equipoVisitante;

    const localHTML = local._esRespaldo
      ? `<span class="team-fallback">${local.name_en}</span>`
      : `${local.flag ? `<img src="${local.flag}" alt="${local.name_en}" class="radar-flag" />` : ""}<span>${local.name_en}</span>`;

    const visitanteHTML = visitante._esRespaldo
      ? `<span class="team-fallback">${visitante.name_en}</span>`
      : `${visitante.flag ? `<img src="${visitante.flag}" alt="${visitante.name_en}" class="radar-flag" />` : ""}<span>${visitante.name_en}</span>`;

    const fecha = p.local_date
      ? new Date(p.local_date).toLocaleDateString("es-CR", { day: "2-digit", month: "short" })
      : "";

    return `
      <div class="radar-celda">
        <div class="radar-celda-equipo">${localHTML}</div>
        <div class="radar-celda-score">${p.home_score} - ${p.away_score}</div>
        <div class="radar-celda-equipo">${visitanteHTML}</div>
        ${fecha ? `<div class="radar-celda-fecha">${fecha}</div>` : ""}
      </div>
    `;
  }).join("");

  grupoEl.innerHTML = `
    <div class="radar-grupo-header">
      <span class="radar-grupo-titulo">Grupo ${grupo}</span>
      <span class="radar-grupo-badge">${totalEmpates} empate${totalEmpates !== 1 ? "s" : ""}</span>
    </div>
    <div class="radar-matriz">${celdasHTML}</div>
  `;
}

// ======================================================================
// AUTO-REFRESH Y ARRANQUE
// ======================================================================

function iniciarAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => cargarGoleadas(), AUTO_REFRESH_MS);
}

async function init() {
  construirChatUI();
  mostrarPantalla(screenGoleadas, navGoleadas);
  await cargarGoleadas();
  iniciarAutoRefresh();
}

init();