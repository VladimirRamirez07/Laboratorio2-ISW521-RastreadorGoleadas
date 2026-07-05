// js/goleadas.js
// Lógica de negocio: filtrar, calcular y ordenar goleadas.
// NO hace fetch, NO toca el DOM. Solo transforma datos ya obtenidos.

/**
 * Calcula la diferencia absoluta de goles de un partido.
 * Usa Number() porque la API devuelve los scores como strings ("2", "0").
 */
function calcularDiferencia(partido) {
  return Math.abs(Number(partido.home_score) - Number(partido.away_score));
}

/**
 * A partir de la lista cruda de partidos (/get/games), devuelve
 * solo los finalizados con diferencia >= 3 goles, ordenados de
 * mayor a menor diferencia.
 * Nota: la API devuelve finished como string "TRUE"/"FALSE", no booleano.
 *
 * @param {Array} partidos - respuesta cruda de getGames()
 * @returns {Array} partidos enriquecidos con campo `diferencia`
 */
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

/**
 * Busca un equipo por id dentro de la lista de equipos.
 * Si no se encuentra (porque /get/teams falló o aún no llegó),
 * devuelve un objeto de respaldo con el id crudo como nombre,
 * para que la vista no se rompa (Reto de Resiliencia 2.2).
 *
 * @param {Array|null} equipos - respuesta cruda de getTeams(), o null si falló
 * @param {string} teamId
 */
function buscarEquipo(equipos, teamId) {
  if (Array.isArray(equipos)) {
    const encontrado = equipos.find(
      (t) => String(t.id) === String(teamId)
    );
    if (encontrado) return encontrado;
  }

  // Respaldo temporal: mostramos el id crudo, no bloqueamos la vista
  return {
    id: teamId,
    name_en: `Equipo #${teamId}`,
    flag: null,
    _esRespaldo: true,
  };
}

/**
 * Enriquece la lista de goleadas con los datos reales de equipo
 * (nombre, bandera) cruzando contra /get/teams.
 *
 * @param {Array} goleadas - resultado de obtenerGoleadas()
 * @param {Array|null} equipos - resultado de getTeams(), o null si falló
 */
function enriquecerConEquipos(goleadas, equipos) {
  return goleadas.map((partido) => ({
    ...partido,
    equipoLocal: buscarEquipo(equipos, partido.home_team_id),
    equipoVisitante: buscarEquipo(equipos, partido.away_team_id),
  }));
}

export {
  obtenerGoleadas,
  enriquecerConEquipos,
  calcularDiferencia,
  buscarEquipo,
};