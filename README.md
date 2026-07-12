# Laboratorio 2 - ISW-521: Rastreador de Goleadas - Mundial 2026

**Curso:** ISW-521 Programacion en Ambiente Web I  
**Universidad:** Universidad Tecnica Nacional  
**Categoria:** A - Cruce de Datos y Analitica  
**Estudiante:** Axel Vladimir Ramirez  
**Fecha de entrega:** 23 de julio de 2026  

---

## Descripcion

Aplicacion JavaScript interactiva de 5 pantallas que consume la API REST publica del
Mundial 2026 ([worldcup26.ir](https://worldcup26.ir)) para identificar y mostrar todas
las goleadas (partidos finalizados con diferencia de goles mayor o igual a 3), ordenadas
de mayor a menor diferencia. Incluye detalle de partido con goleadores individuales,
estadisticas del torneo, analisis con inteligencia artificial y vista agrupada por grupo.

---

## Pantallas

| # | Pantalla | Funcionalidad |
|---|----------|---------------|
| 1 | **Dashboard** | Lista de goleadas con banderas, buscador en tiempo real, ordenamiento por diferencia o fecha, auto-refresh cada 5 minutos |
| 2 | **Detalle de Partido** | Score, equipos con bandera, goleadores con minutos, grupo, fecha y estadio. Accesible desde Dashboard y Por Grupos |
| 3 | **Estadisticas** | Equipo mas goleador, promedio de diferencia, total de goles, goleador mas frecuente, barras de goleadas por grupo |
| 4 | **Analista IA** | Chat pantalla completa con contexto real de goleadas, selector de modelo Groq/Cerebras |
| 5 | **Por Grupos** | Goleadas agrupadas por grupo A-L con totales de goles, mayor diferencia y click directo a detalle |

---

## Arquitectura del Proyecto
```
Laboratorio2-ISW521-RastreadorGoleadas/
├── index.html              → 5 pantallas via show/hide de secciones, navbar de navegacion
├── css/
│   └── styles.css          → Diseno oscuro completo: navbar, tarjetas, detalle, stats, grupos, chat
├── js/
│   ├── api.js              → Fetch puro: getGames, getTeams, getTeamsBackground, backoff exponencial (sin JWT)
│   ├── auth.js             → Archivo vacio de compatibilidad (autenticacion no aplica segun profesor)
│   ├── storage.js          → localStorage para cache offline de games y teams
│   ├── goleadas.js         → Logica de negocio: filtrar, calcular diferencia, ordenar, cruzar equipos, parsear goleadores
│   ├── chat.js             → Chat IA flotante + pantalla completa: Groq y Cerebras, historial, contexto de goleadas
│   └── main.js             → Orquestador: 5 pantallas, DOM, eventos, render, resiliencia 2.2
├── proxy-server.js         → Proxy local Node/Express (resuelve CORS + endpoints de IA)
├── .env                    → Variables de entorno con API keys (no se sube al repo)
├── .env.example            → Ejemplo de variables de entorno
├── package.json
└── .gitignore
```
---

## Requisitos Tecnicos Implementados

| Requisito | Implementacion |
|---|---|
| `async/await` exclusivo | Cero `.then()/.catch()` en todo el codigo |
| Backoff exponencial 429/500 | Reintentos automaticos: 1s, 2s, 4s, 8s (`api.js`) |
| Countdown visible en 429 | Toast inferior con cuenta regresiva en segundos (`main.js`) |
| Modo offline con localStorage | Ultima respuesta exitosa cacheada; banner amarillo de datos no actualizados |
| Reto de Resiliencia 2.2 | Si `/get/teams` falla, la lista se renderiza con ids de respaldo (`Equipo #id`) y se reintenta en segundo plano con backoff; cuando tiene exito los nombres reales reemplazan los respaldos sin recargar la pagina |
| Sin `alert()` | Prohibicion cumplida en todo el codigo |
| Sin `window.location.reload()` | Prohibicion cumplida en todo el codigo |
| Separacion fetch/presentacion | `api.js` nunca toca el DOM, `main.js` nunca hace fetch directo |

---

## Funcionalidades

- 5 pantallas con navegacion por navbar (JavaScript puro, sin frameworks)
- Buscador en tiempo real por nombre de equipo
- Ordenamiento por mayor diferencia de goles o por fecha del partido
- Auto-refresh automatico cada 5 minutos
- Indicador de ultima actualizacion con timestamp en el header
- Badge "En vivo" / "Cache" segun origen de los datos
- Numeracion de goleadas (#1, #2, #3...)
- Click en tarjeta o fila → pantalla de Detalle con goleadores individuales
- Estadisticas derivadas calculadas en el frontend (sin endpoint dedicado)
- Chat de IA flotante disponible en todas las pantallas
- Chat de IA en pantalla completa con selector de modelo

---

## Chat de IA - Analista del Mundial 2026

El chat esta disponible de dos formas:
- **Flotante** — boton "Analista IA" abajo a la derecha, disponible en todas las pantallas
- **Pantalla completa** — pestana "Analista IA" en el navbar, con mas espacio para la conversacion

### Modelos disponibles
- **Groq** con `llama-3.3-70b-versatile` — velocidad de inferencia extremadamente rapida
- **Cerebras** con `llama-3.3-70b` — el modelo mas rapido del mercado para LLMs grandes

### Que puede responder el chat
- Goleadores individuales de cada partido (nombres y minutos exactos)
- Resultados, diferencias y fechas de todos los partidos con goleada
- Rankings: cual fue la mayor goleada, equipos mas ofensivos, etc.
- Analisis tactico de por que un equipo goleo a otro
- Impacto de cada resultado en la clasificacion del grupo

### Arquitectura del chat
Las llamadas a Groq y Cerebras pasan por el proxy local (`proxy-server.js`) para mantener
las API keys en el servidor y nunca exponerlas en el frontend. El contexto de goleadas
(equipos, scores, fechas, goleadores) se inyecta automaticamente en el system prompt
de cada conversacion.

---

## Nota sobre CORS

La API publica `worldcup26.ir` no incluye el header `Access-Control-Allow-Origin`
en sus respuestas, lo que bloquea las peticiones desde el navegador.

La solucion implementada es un proxy local (`proxy-server.js`) con Node.js + Express
que reenvía las peticiones al servidor real. Las peticiones servidor-a-servidor no estan
sujetas a la politica CORS (exclusiva de navegadores), por lo que el proxy puede
comunicarse con la API sin restricciones.

---

## Configuracion de Variables de Entorno

Crea un archivo `.env` en la raiz del proyecto:
GROQ_API_KEY=tu_api_key_de_groq
CEREBRAS_API_KEY=tu_api_key_de_cerebras
Para obtener las keys:
- Groq: [console.groq.com](https://console.groq.com) → API Keys → Create API Key
- Cerebras: [cloud.cerebras.ai](https://cloud.cerebras.ai) → API Keys → Generate API Key

---

## Como ejecutar el proyecto

### Prerrequisitos
- Node.js 18 o superior
- Extension **Live Server** instalada en VS Code
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
Proxy corriendo en http://localhost:3000
Reenviando peticiones hacia https://worldcup26.ir
Chat IA disponible en /proxy/ai/groq y /proxy/ai/cerebras
**3. Iniciar el frontend con Live Server (VS Code):**
Clic derecho en `index.html` → Open with Live Server  
O clic en el boton **Go Live** en la barra inferior de VS Code.

**4. Abrir la app en el navegador:**
http://127.0.0.1:5500/index.html
La app abre directamente en el Dashboard sin necesidad de login.  
Ambos procesos (proxy en puerto 3000 y Live Server en puerto 5500) deben
estar corriendo simultaneamente para que la app funcione.

---

## Escenarios de Resiliencia Demostrables en DevTools

| Escenario | Como simularlo | Comportamiento esperado |
|---|---|---|
| **500 Error de servidor** | Clic en "Probar 500" en el Dashboard | Backoff exponencial con countdown, luego cache offline con banner amarillo |
| **429 Limite de tasa** | Clic en "Probar 429" en el Dashboard | Toast con countdown visible en segundos, reintentos automaticos |
| **Offline** | Desconectar internet → Recargar datos | Datos del localStorage con banner de advertencia amarillo |
| **Teams falla, games ok** | Simular fallo de `/get/teams` en DevTools → Network → Block request URL | Lista con ids de respaldo, reintento en background, nombres reales aparecen solos |

---

## Endpoints consumidos

| Endpoint | Uso |
|----------|-----|
| `GET /get/games` | Partidos del torneo — se filtra por `finished=TRUE` y diferencia >= 3 |
| `GET /get/teams` | Equipos — se cruza por `home_team_id` y `away_team_id` para nombres y banderas |
| `POST /proxy/ai/groq` | Chat con Groq (llama-3.3-70b-versatile) |
| `POST /proxy/ai/cerebras` | Chat con Cerebras (llama-3.3-70b) |

---

## Tecnologias Utilizadas

- JavaScript ES6+ (modulos, async/await, fetch) — sin frameworks
- HTML5 semantico
- CSS3 (variables, flexbox, animaciones)
- Node.js + Express (proxy local)
- API worldcup26.ir (datos del Mundial 2026)
- Groq API (chat IA con Llama 3.3)
- Cerebras API (chat IA con Llama 3.3)
- dotenv (manejo de variables de entorno)
- Git + GitHub (control de versiones)