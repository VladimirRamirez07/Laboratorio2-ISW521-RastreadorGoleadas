// js/muro.js
// Logica de negocio — El Muro
// NO hace fetch directo, NO toca el DOM. Solo transforma datos.

// Extrae los 48 registros de equipo+ga de todos los grupos
// Cada grupo tiene teams: [{team_id, ga, gf, pts, ...}]
function extraerRegistrosGa(grupos) {
  const registros = [];
  if (!Array.isArray(grupos)) return registros;

  grupos.forEach((grupo) => {
    const equipos = grupo.teams || grupo.standings || [];
    equipos.forEach((entry) => {
      registros.push({
        team_id: entry.team_id,
        ga:      Number(entry.ga) || 0,
        grupo:   grupo.name || grupo.group || "",
      });
    });
  });

  return registros;
}

// Ordena ascendente por ga y toma los primeros N (default 5)
function obtenerTopMenosGoleados(registros, top = 5) {
  return [...registros]
    .sort((a, b) => a.ga - b.ga || a.team_id - b.team_id)
    .slice(0, top);
}

// Cruza con equipos para agregar name_en y flag
function enriquecerConEquipos(registros, equipos) {
  return registros.map((r) => {
    const equipo = Array.isArray(equipos)
      ? equipos.find((t) => String(t.id) === String(r.team_id))
      : null;
    return {
      ...r,
      name_en: equipo ? equipo.name_en : `Equipo #${r.team_id}`,
      flag:    equipo ? equipo.flag    : null,
      _esRespaldo: !equipo,
    };
  });
}

// Busca el proximo partido con finished !== TRUE para un equipo
// Retorna el partido o null si no hay
function buscarProximoPartido(partidos, teamId) {
  if (!Array.isArray(partidos)) return null;

  const pendientes = partidos.filter((p) => {
    const fin = p.finished;
    const esFinalizado =
      fin === true ||
      fin === 1 ||
      (typeof fin === "string" && fin.toUpperCase() === "TRUE");
    return (
      !esFinalizado &&
      (String(p.home_team_id) === String(teamId) ||
       String(p.away_team_id) === String(teamId))
    );
  });

  if (pendientes.length === 0) return null;

  return pendientes.sort(
    (a, b) => new Date(a.local_date) - new Date(b.local_date)
  )[0];
}

// Agrega el proximo rival a cada entrada del top 5
// rivalData es un array de { team_id, partido | null, error | null }
function enriquecerConRivales(topEnriquecido, rivalData, equipos) {
  return topEnriquecido.map((entrada) => {
    const rivalEntry = rivalData.find(
      (r) => String(r.team_id) === String(entrada.team_id)
    );

    if (!rivalEntry) {
      return { ...entrada, proximoRival: null, proximoRivalError: true };
    }

    if (rivalEntry.error) {
      return { ...entrada, proximoRival: null, proximoRivalError: true };
    }

    if (!rivalEntry.partido) {
      return { ...entrada, proximoRival: null, proximoRivalError: false };
    }

    const partido   = rivalEntry.partido;
    const esLocal   = String(partido.home_team_id) === String(entrada.team_id);
    const rivalId   = esLocal ? partido.away_team_id : partido.home_team_id;
    const equipoRival = Array.isArray(equipos)
      ? equipos.find((t) => String(t.id) === String(rivalId))
      : null;

    return {
      ...entrada,
      proximoRival: {
        name_en:    equipoRival ? equipoRival.name_en : `Equipo #${rivalId}`,
        flag:       equipoRival ? equipoRival.flag    : null,
        local_date: partido.local_date,
        esLocal,
      },
      proximoRivalError: false,
    };
  });
}

export {
  extraerRegistrosGa,
  obtenerTopMenosGoleados,
  enriquecerConEquipos,
  buscarProximoPartido,
  enriquecerConRivales,
};