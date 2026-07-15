# Laboratorio 2 - ISW-521: Mundial 2026

**Curso:** ISW-521 Programacion en Ambiente Web I  
**Universidad:** Universidad Tecnica Nacional  
**Categoria:** A - Cruce de Datos y Analitica  
**Estudiante:** Axel Vladimir Ramirez  
**Fecha de entrega:** 16 de julio de 2026  

---

## Descripcion

Aplicacion JavaScript interactiva de 5 subproyectos que consume la API REST publica del Mundial 2026 (worldcup26.ir) para analizar y visualizar datos del torneo. Cada subproyecto cruza multiples colecciones de la API (equipos, partidos, grupos y estadios) para construir vistas derivadas con logica de negocio separada de la presentacion.

---

## Subproyectos

| # | Subproyecto | Endpoints consumidos | Descripcion |
|---|---|---|---|
| 1 | **Goleadas** | `/get/games`, `/get/teams` | Partidos finalizados con diferencia mayor o igual a 3 goles, ordenados de mayor a menor diferencia |
| 2 | **Ruta del Campeon** | `/get/games`, `/get/teams`, `/get/stadiums` | Itinerario de partidos de un equipo seleccionado con ciudad, pais y aforo de cada recinto |
| 3 | **El Muro** | `/get/groups`, `/get/teams`, `/get/games` | Los 5 equipos con menos goles recibidos en fase de grupos y su proximo rival |
| 4 | **Analitica de Estadios** | `/get/stadiums`, `/get/games` | Grafica de barras comparando capacidad vs asistencia potencial por recinto |
| 5 | **Radar de Empates** | `/get/games`, `/get/teams` | Matriz visual de partidos empatados agrupados por grupo A-L |

---

## Arquitectura del Proyecto

```
Laboratorio2-ISW521-RastreadorGoleadas/
├── index.html               — 5 subproyectos via show/hide, navbar universal con timestamp y badge
├── css/
│   └── styles.css           — Diseno oscuro completo para los 5 subproyectos
├── js/
│   ├── api.js               — Fetch puro: getGames, getTeams, getStadiums, getGroups, backoff exponencial
│   ├── auth.js              — Archivo vacio de compatibilidad (autenticacion no aplica segun profesor)
│   ├── storage.js           — Cache offline con localStorage para todos los endpoints
│   ├── goleadas.js          — Logica de negocio: filtrar, calcular diferencia, ordenar, cruzar equipos
│   ├── ruta.js              — Logica de negocio: itinerario, cruce con estadios, ciudades distintas
│   ├── muro.js              — Logica de negocio: extraer ga de grupos, top 5, proximo rival
│   ├── estadios.js          — Logica de negocio: conteo de partidos, asistencia potencial
│   ├── empates.js           — Logica de negocio: filtrar empates, agrupar por grupo
│   ├── chat.js              — Chat IA flotante universal: Groq y Cerebras, contexto del torneo
│   └── main.js              — Orquestador: 5 subproyectos, DOM, eventos, render, resiliencia
├── proxy-server.js          — Proxy local Node/Express (resuelve CORS + endpoints de IA)
├── .env                     — Variables de entorno con API keys (no se sube al repo)
├── .env.example             — Ejemplo de variables de entorno
├── package.json
└── .gitignore
```

---

## Requisitos Tecnicos Implementados

| Requisito | Implementacion |
|---|---|
| `async/await` exclusivo | Cero `.then()/.catch()` en todo el codigo |
| Backoff exponencial 429/500 | Reintentos automaticos: 1s, 2s, 4s, 8s en `api.js` |
| Countdown visible en 429 | Toast inferior con cuenta regresiva en segundos |
| Modo offline con localStorage | Ultima respuesta exitosa cacheada por endpoint; banner amarillo de datos no actualizados |
| Badge En vivo / Cache | Cambia automaticamente segun origen de los datos en el navbar |
| Sin `alert()` | Prohibicion cumplida en todo el codigo |
| Sin `.then()/.catch()` | Prohibicion cumplida en todo el codigo |
| Sin `window.location.reload()` | Prohibicion cumplida en todo el codigo |
| Separacion fetch/presentacion | `api.js` nunca toca el DOM; los modulos de logica nunca hacen fetch; solo `main.js` une ambas capas |

---

## Retos de Resiliencia por Subproyecto

| Subproyecto | Reto implementado |
|---|---|
| **Goleadas** | Si `/get/teams` falla, la lista se renderiza con ids de respaldo y se reintenta en segundo plano; cuando tiene exito los nombres reales reemplazan los respaldos sin recargar la pagina |
| **Ruta del Campeon** | Si `/get/stadiums` falla despues de renderizar los partidos, las tarjetas no desaparecen; cada tarjeta muestra "Estadio no disponible" y solo esa peticion entra en backoff en background |
| **El Muro** | La busqueda del proximo rival se evalua equipo por equipo; si falla para uno ese muestra "Proximo rival no disponible" mientras los otros 4 siguen normales |
| **Analitica de Estadios** | Si `/get/games` falla despues de cargar estadios, la grafica entra en estado de espera sin destruir las barras ya dibujadas; solo la peticion de partidos entra en backoff en background |
| **Radar de Empates** | Cada grupo se renderiza de forma independiente; si falla uno solo ese muestra un error parcial mientras los demas grupos permanecen visibles |

---

## Chat IA - Analista del Mundial 2026

El chat flotante esta disponible en todas las pantallas del sistema. El contexto se alimenta con datos reales de los 5 subproyectos (goleadas, estadios, equipos).

### Modelos disponibles
- **Groq** con `llama-3.3-70b-versatile`
- **Cerebras** con `llama-3.3-70b`

### Arquitectura del chat
Las llamadas a Groq y Cerebras pasan por el proxy local para mantener las API keys en el servidor y nunca exponerlas en el frontend.

---

## Nota sobre CORS

La API publica `worldcup26.ir` no incluye el header `Access-Control-Allow-Origin`, lo que bloquea las peticiones desde el navegador. La solucion implementada es un proxy local con Node.js + Express que reenvía las peticiones al servidor real. Las peticiones servidor-a-servidor no estan sujetas a la politica CORS.

---

## Configuracion de Variables de Entorno

Crea un archivo `.env` en la raiz del proyecto:

```
GROQ_API_KEY=tu_api_key_de_groq
CEREBRAS_API_KEY=tu_api_key_de_cerebras
```

Para obtener las keys:
- Groq: console.groq.com -> API Keys -> Create API Key
- Cerebras: cloud.cerebras.ai -> API Keys -> Generate API Key

---

## Como ejecutar el proyecto

### Prerrequisitos
- Node.js 18 o superior
- Extension Live Server instalada en VS Code
- Archivo `.env` configurado con las API keys

### Pasos

**1. Instalar dependencias:**
```bash
npm install
```

**2. Iniciar el proxy local (Terminal 1):**
```bash
node proxy-server.js
```

Debe mostrar:
```
Proxy corriendo en http://localhost:3000
Reenviando peticiones hacia https://worldcup26.ir
  GET  /proxy/get/games
  GET  /proxy/get/teams
  GET  /proxy/get/stadiums
  GET  /proxy/get/groups
  GET  /proxy/test/500
  GET  /proxy/test/429
  POST /proxy/ai/groq
  POST /proxy/ai/cerebras
```

**3. Iniciar el frontend con Live Server (VS Code):**

Clic derecho en `index.html` -> Open with Live Server  
O clic en el boton Go Live en la barra inferior de VS Code.

**4. Abrir la app en el navegador:**
```
http://127.0.0.1:5500/index.html
```

Ambos procesos deben estar corriendo simultaneamente para que la app funcione.

---

## Escenarios de Resiliencia Demostrables en DevTools

| Escenario | Como simularlo | Comportamiento esperado |
|---|---|---|
| **500 Error de servidor** | Clic en "Probar 500" | Backoff exponencial con countdown, luego cache offline con banner amarillo |
| **429 Limite de tasa** | Clic en "Probar 429" | Toast con countdown visible en segundos, reintentos automaticos |
| **Offline** | DevTools -> Network -> Offline -> "Recargar datos" | Badge cambia a "Cache", banner amarillo, datos del localStorage visibles |
| **Teams falla** | DevTools -> Network -> bloquear `/get/teams` | Lista con ids de respaldo, reintento en background, nombres reales aparecen solos |

---

## Endpoints consumidos

| Endpoint | Usado por |
|---|---|
| `GET /get/games` | Goleadas, Ruta del Campeon, El Muro, Analitica de Estadios, Radar de Empates |
| `GET /get/teams` | Goleadas, Ruta del Campeon, El Muro, Radar de Empates |
| `GET /get/stadiums` | Ruta del Campeon, Analitica de Estadios |
| `GET /get/groups` | El Muro |
| `POST /proxy/ai/groq` | Chat IA (Groq llama-3.3-70b-versatile) |
| `POST /proxy/ai/cerebras` | Chat IA (Cerebras llama-3.3-70b) |

---

## Tecnologias Utilizadas

- JavaScript ES6+ (modulos, async/await, fetch) — sin frameworks
- HTML5 semantico
- CSS3 (variables, flexbox, animaciones, grid)
- Node.js + Express (proxy local)
- API worldcup26.ir (datos del Mundial 2026)
- Groq API (chat IA con Llama 3.3)
- Cerebras API (chat IA con Llama 3.3)
- dotenv (manejo de variables de entorno)
- Git + GitHub (control de versiones)