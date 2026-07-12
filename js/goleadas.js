// js/goleadas.js
// Lógica de negocio: filtrar, calcular y ordenar goleadas.
// NO hace fetch, NO toca el DOM. Solo transforma datos ya obtenidos.

function calcularDiferencia(partido) {
  return Math.abs(Number(partido.home_score) - Number(partido.away_score));
}

function obtenerGoleadas(partidos) {
  if (!Array.isArray(partidos)) return [];

  return partidos
    .filter((p) => {
      const fin = p.finished;
      return (
        fin === true ||
        fin === 1 ||
        (typeof fin === "string" && fin.toUpperCase() === "TRUE")
      );
    })
    .map((p) => ({ ...p, diferencia: calcularDiferencia(p) }))
    .filter((p) => p.diferencia >= 3)
    .sort((a, b) => b.diferencia - a.diferencia);
}

function buscarEquipo(equipos, teamId) {
  if (Array.isArray(equipos)) {
    const encontrado = equipos.find((t) => String(t.id) === String(teamId));
    if (encontrado) return encontrado;
  }
  return {
    id: teamId,
    name_en: `Equipo #${teamId}`,
    flag: null,
    _esRespaldo: true,
  };
}

function enriquecerConEquipos(goleadas, equipos) {
  return goleadas.map((partido) => ({
    ...partido,
    equipoLocal: buscarEquipo(equipos, partido.home_team_id),
    equipoVisitante: buscarEquipo(equipos, partido.away_team_id),
  }));
}

function parsearGoleadores(raw) {
  if (!raw || raw === "null" || raw === "NULL") return [];
  try {
    return raw
      .replace(/^\{/, "")
      .replace(/\}$/, "")
      .split(",")
      .map((g) => g.replace(/"/g, "").replace(/'/g, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export { obtenerGoleadas, enriquecerConEquipos, calcularDiferencia, buscarEquipo, parsearGoleadores };