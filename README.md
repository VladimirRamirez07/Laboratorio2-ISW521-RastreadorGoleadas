# Laboratorio 2 - ISW-521: Rastreador de Goleadas - Mundial 2026

**Curso:** ISW-521 Programacion en Ambiente Web I  
**Universidad:** Universidad Tecnica Nacional  
**Categoria:** A - Cruce de Datos y Analitica  
**Estudiante:** Axel Vladimir Ramirez  
**Fecha de entrega:** 16 de julio de 2026  

---

## Descripcion

Aplicacion JavaScript interactiva que consume la API REST publica del Mundial 2026
([worldcup26.ir](https://worldcup26.ir)) para identificar y mostrar todas las goleadas
(partidos finalizados con diferencia de goles mayor o igual a 3), ordenadas de mayor
a menor diferencia. Incluye un chat de analisis con inteligencia artificial powered by
Groq y Cerebras con contexto real de los partidos.

---

## Arquitectura del Proyecto
```
Laboratorio2-ISW521-RastreadorGoleadas/
├── index.html              → Estructura HTML: login, dashboard, modales, chat flotante
├── css/
│   └── styles.css          → Estilos: diseno oscuro, tarjetas, modal, toast, chat IA
├── js/
│   ├── api.js              → Fetch puro: login JWT, getGames, getTeams, backoff exponencial
│   ├── auth.js             → Manejo de sesion: login, logout, modal sesion expirada (401)
│   ├── storage.js          → localStorage (cache offline) y sessionStorage (token, username)
│   ├── goleadas.js         → Logica de negocio: filtrar, calcular diferencia, ordenar, cruzar equipos
│   ├── chat.js             → Chat flotante con IA: Groq y Cerebras, historial, contexto de goleadas
│   └── main.js             → Orquestador: DOM, eventos, render (unico archivo que toca el DOM)
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
| Autenticacion JWT | Login contra `/auth/authenticate`, token enviado en `Authorization: Bearer` en cada peticion |
| `async/await` exclusivo | Cero `.then()/.catch()` en todo el codigo |
| Manejo de 401 sin reload | Modal de sesion expirada con opcion de reautenticarse (`auth.js`) |
| Backoff exponencial 429/500 | Reintentos automaticos: 1s, 2s, 4s, 8s (`api.js`) |
| Countdown visible en 429 | Toast inferior con cuenta regresiva en segundos (`main.js`) |
| Modo offline con localStorage | Ultima respuesta exitosa cacheada; indicador de datos no actualizados (`storage.js`) |
| Sin `alert()` | Prohibicion cumplida en todo el codigo |
| Sin `window.location.reload()` | Prohibicion cumplida; el 401 se resuelve con modal + `showLogin()` |
| Separacion fetch/presentacion | `api.js` nunca toca el DOM, `main.js` nunca hace fetch directo |

---

## Funcionalidades Extra

- Buscador en tiempo real por nombre de equipo
- Ordenamiento por mayor diferencia de goles o por fecha del partido
- Auto-refresh automatico cada 5 minutos
- Indicador de ultima actualizacion con timestamp en el header
- Badge "En vivo" / "Cache" segun origen de los datos
- Confirmacion de cierre de sesion con modal
- Numeracion de goleadas (#1, #2, #3...)
- Fecha de cada partido en la tarjeta
- Chat de IA flotante con analisis tactico del torneo

---

## Chat de IA - Analista del Mundial 2026

El chat flotante (boton "Analista IA" abajo a la derecha) permite hacer consultas sobre
los partidos del torneo usando modelos de lenguaje de ultima generacion.

### Modelos disponibles
- **Groq** con `llama-3.3-70b-versatile` — velocidad de inferencia extremadamente rapida
- **Cerebras** con `llama-3.3-70b` — el modelo mas rapido del mercado para LLMs grandes

### Que puede responder el chat
- Goleadores individuales de cada partido (nombres y minutos exactos)
- Resultados, diferencias y fechas de todos los partidos con goleada
- Rankings: cual fue la mayor goleada, equipos mas ofensivos, etc.
- Analisis tactico de por que un equipo goleo a otro
- Contexto historico de cada seleccion en mundiales anteriores
- Impacto de cada resultado en la clasificacion del grupo
- Predicciones de proximas fases basadas en los resultados reales

### Arquitectura del chat
Las llamadas a Groq y Cerebras pasan por el proxy local (`proxy-server.js`) para mantener
las API keys en el servidor y nunca exponerlas en el frontend. El contexto de goleadas
(equipos, scores, fechas, goleadores) se inyecta automaticamente en el system prompt
de cada conversacion.

---

## Nota sobre CORS

La API publica `worldcup26.ir` no incluye el header `Access-Control-Allow-Origin`
en sus respuestas, lo que bloquea las peticiones desde el navegador. Esto es un bug
del servidor de terceros, documentado en la pestana Network de DevTools (preflight
OPTIONS responde 204 pero sin el header requerido).

La solucion implementada es un proxy local (`proxy-server.js`) con Node.js + Express
que reenvía las peticiones al servidor real. Las peticiones servidor-a-servidor no estan
sujetas a la politica CORS (exclusiva de navegadores), por lo que el proxy puede
comunicarse con la API sin restricciones.

---

## Configuracion de Variables de Entorno

Crea un archivo `.env` en la raiz del proyecto con el siguiente contenido:
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

**5. Credenciales de prueba:**
Email:    vladimir.lab2.isw521@test.com
Password: Lab2Test2026!

Ambos procesos (proxy en puerto 3000 y Live Server en puerto 5500) deben
estar corriendo simultaneamente para que la app funcione.

---

## Escenarios de Resiliencia Demostrables en DevTools

| Escenario | Como simularlo | Comportamiento esperado |
|---|---|---|
| **401 Sesion expirada** | Clic en boton "Probar 401" en el dashboard | Modal "Sesion expirada" sin reload |
| **500 Error de servidor** | Clic en boton "Probar 500" en el dashboard | Backoff exponencial con countdown, luego cache offline |
| **429 Limite de tasa** | Clic en boton "Probar 429" en el dashboard | Toast con countdown visible en segundos |
| **Offline** | Desconectar internet → Recargar datos | Datos del localStorage con banner de advertencia amarillo |

---

## Tecnologias Utilizadas

- JavaScript ES6+ (modulos, async/await, fetch)
- HTML5 semantico
- CSS3 (variables, flexbox, animaciones)
- Node.js + Express (proxy local)
- API worldcup26.ir (datos del Mundial 2026)
- Groq API (chat IA con Llama 3.3)
- Cerebras API (chat IA con Llama 3.3)
- dotenv (manejo de variables de entorno)
- Git + GitHub (control de versiones)