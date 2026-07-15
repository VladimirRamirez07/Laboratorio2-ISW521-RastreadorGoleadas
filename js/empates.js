// js/empates.js
// Logica de negocio — Radar de Empates
// NO hace fetch directo, NO toca el DOM. Solo transforma datos.

// Filtra partidos empatados y finalizados
function obtenerEmpates(partidos) {
  if (!Array.isArray(partidos)) return [];

  return partidos.filter((p) => {
    const fin = p.finished;
    const esFinalizado =
      fin === true ||
      fin === 1 ||
      (typeof fin === "string" && fin.toUpperCase() === "TRUE");

    return (
      esFinalizado &&
      Number(p.home_score) === Number(p.away_score)
    );
  });
}

// Agrupa empates por grupo (A-L)
function agruparPorGrupo(empates) {
  const agrupado = {};
  empates.forEach((p) => {
    const grupo = p.group || "N/A";
    if (!agrupado[grupo]) agrupado[grupo] = [];
    agrupado[grupo].push(p);
  });
  return agrupado;
}

// Enriquece cada empate con nombre y bandera de ambos equipos
function enriquecerConEquipos(empates, equipos) {
  return empates.map((p) => {
    const local     = buscarEquipo(equipos, p.home_team_id);
    const visitante = buscarEquipo(equipos, p.away_team_id);
    return { ...p, equipoLocal: local, equipoVisitante: visitante };
  });
}

function buscarEquipo(equipos, teamId) {
  if (Array.isArray(equipos)) {
    const encontrado = equipos.find((t) => String(t.id) === String(teamId));
    if (encontrado) return encontrado;
  }
  return { id: teamId, name_en: `Equipo #${teamId}`, flag: null, _esRespaldo: true };
}

// Calcula totales por grupo para el contador
function calcularTotalesPorGrupo(agrupadoEnriquecido) {
  const totales = {};
  Object.entries(agrupadoEnriquecido).forEach(([grupo, empates]) => {
    totales[grupo] = empates.length;
  });
  return totales;
}

export {
  obtenerEmpates,
  agruparPorGrupo,
  enriquecerConEquipos,
  calcularTotalesPorGrupo,
};