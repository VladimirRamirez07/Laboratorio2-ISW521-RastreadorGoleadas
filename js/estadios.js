// js/estadios.js
// Logica de negocio — Analitica de Estadios
// NO hace fetch directo, NO toca el DOM. Solo transforma datos.

// Cuenta partidos por stadium_id
function contarPartidosPorEstadio(partidos) {
  const conteo = {};
  if (!Array.isArray(partidos)) return conteo;
  partidos.forEach((p) => {
    const sid = String(p.stadium_id);
    conteo[sid] = (conteo[sid] || 0) + 1;
  });
  return conteo;
}

// Calcula asistencia potencial: capacity * cantidad de partidos
// Ordena de mayor a menor asistencia potencial
function calcularAsistenciaPotencial(estadios, conteoPartidos) {
  if (!Array.isArray(estadios)) return [];

  return estadios
    .map((estadio) => {
      const sid       = String(estadio.id);
      const partidos  = conteoPartidos[sid] || 0;
      const capacity  = Number(estadio.capacity) || 0;
      const asistencia = capacity * partidos;
      return {
        ...estadio,
        partidosAlbergados: partidos,
        asistenciaPotencial: asistencia,
      };
    })
    .sort((a, b) => b.asistenciaPotencial - a.asistenciaPotencial);
}

// Calcula el maximo de asistencia potencial para normalizar la grafica
function obtenerMaximoAsistencia(estadiosCalculados) {
  if (!estadiosCalculados.length) return 1;
  return Math.max(...estadiosCalculados.map((e) => e.asistenciaPotencial)) || 1;
}

// Calcula el maximo de capacidad para normalizar barras de capacidad
function obtenerMaximoCapacidad(estadiosCalculados) {
  if (!estadiosCalculados.length) return 1;
  return Math.max(...estadiosCalculados.map((e) => Number(e.capacity) || 0)) || 1;
}

export {
  contarPartidosPorEstadio,
  calcularAsistenciaPotencial,
  obtenerMaximoAsistencia,
  obtenerMaximoCapacidad,
};