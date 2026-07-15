// js/ruta.js
// Logica de negocio — La Ruta del Campeon
// NO hace fetch directo, NO toca el DOM. Solo transforma datos.

// Filtra partidos donde el equipo participa (local o visitante)
// ordenados por local_date ascendente
function obtenerPartidosDeEquipo(partidos, teamId) {
  if (!Array.isArray(partidos)) return [];
  return partidos
    .filter((p) =>
      String(p.home_team_id) === String(teamId) ||
      String(p.away_team_id) === String(teamId)
    )
    .sort((a, b) => new Date(a.local_date) - new Date(b.local_date));
}

// Cruza cada partido con el mapa de estadios
// Si el estadio no existe devuelve objeto con flag _sinEstadio = true
function enriquecerConEstadios(partidos, estadiosMap) {
  return partidos.map((partido) => {
    const estadio = estadiosMap[String(partido.stadium_id)];
    return {
      ...partido,
      estadio: estadio
        ? { ...estadio, _sinEstadio: false }
        : { _sinEstadio: true, name: "Estadio no disponible", city_en: "", country_en: "", capacity: null },
    };
  });
}

// Cuenta ciudades distintas visitadas segun city_en de los estadios
function contarCiudadesDistintas(partidosEnriquecidos) {
  const ciudades = new Set();
  partidosEnriquecidos.forEach((p) => {
    if (p.estadio && !p.estadio._sinEstadio && p.estadio.city_en) {
      ciudades.add(p.estadio.city_en);
    }
  });
  return ciudades.size;
}

// Construye un Map de id -> estadio para busquedas O(1)
function construirMapaEstadios(estadios) {
  const mapa = {};
  if (!Array.isArray(estadios)) return mapa;
  estadios.forEach((e) => { mapa[String(e.id)] = e; });
  return mapa;
}

// Busca equipo por id, devuelve objeto de respaldo si no existe
function buscarEquipo(equipos, teamId) {
  if (Array.isArray(equipos)) {
    const encontrado = equipos.find((t) => String(t.id) === String(teamId));
    if (encontrado) return encontrado;
  }
  return { id: teamId, name_en: `Equipo #${teamId}`, flag: null, _esRespaldo: true };
}

// Enriquece cada partido con nombre y bandera de ambos equipos
function enriquecerConEquipos(partidos, equipos) {
  return partidos.map((p) => ({
    ...p,
    equipoLocal:     buscarEquipo(equipos, p.home_team_id),
    equipoVisitante: buscarEquipo(equipos, p.away_team_id),
  }));
}

export {
  obtenerPartidosDeEquipo,
  enriquecerConEstadios,
  contarCiudadesDistintas,
  construirMapaEstadios,
  enriquecerConEquipos,
  buscarEquipo,
};