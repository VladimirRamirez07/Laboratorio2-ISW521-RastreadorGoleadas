# Rastreador de Goleadas - Mundial 2026

**Laboratorio 2 · ISW-521 Programación en Ambiente Web I**  
**Universidad Técnica Nacional · Categoría A: Cruce de Datos y Analítica**  
**Estudiante:** Axel Vladimir Ramírez  
**Fecha de entrega:** 16 de julio de 2026

---

## Descripción

Aplicación JavaScript interactiva que consume la API REST pública del Mundial 2026
([worldcup26.ir](https://worldcup26.ir)) para identificar y mostrar todas las goleadas
(partidos finalizados con diferencia de goles mayor o igual a 3), ordenadas de mayor
a menor diferencia.

---

## Arquitectura del Proyecto
```
Laboratorio2-ISW521-RastreadorGoleadas/
├── index.html           → Estructura HTML: pantalla de login, dashboard, modal 401, toast 429/500
├── css/
│   └── styles.css       → Estilos: diseño oscuro, tarjetas de goleadas, modal, toast
├── js/
│   ├── api.js           → Fetch puro: login JWT, getGames, getTeams, backoff exponencial
│   ├── auth.js          → Manejo de sesión: login, logout, modal de sesión expirada (401)
│   ├── storage.js       → localStorage (caché offline) y sessionStorage (token, username)
│   ├── goleadas.js      → Lógica de negocio: filtrar, calcular diferencia, ordenar, cruzar equipos
│   └── main.js          → Orquestador: DOM, eventos, render (único archivo que toca el DOM)
├── proxy-server.js      → Proxy local Node/Express (resuelve CORS de la API pública)
├── package.json
└── .gitignore
```
---

## Requisitos Técnicos Implementados

| Requisito | Implementación |
|---|---|
| Autenticación JWT | Login contra `/auth/authenticate`, token enviado en `Authorization: Bearer` en cada petición |
| `async/await` exclusivo | Cero `.then()/.catch()` en todo el código |
| Manejo de 401 sin reload | Modal de "sesión expirada" con opción de reautenticarse (`auth.js`) |
| Backoff exponencial 429/500 | Reintentos automáticos: 1s → 2s → 4s → 8s (`api.js`) |
| Countdown visible en 429 | Toast inferior con cuenta regresiva en segundos (`main.js`) |
| Modo offline con localStorage | Última respuesta exitosa cacheada; indicador de "datos no actualizados" (`storage.js`) |
| Sin `alert()` | Prohibición cumplida en todo el código |
| Sin `window.location.reload()` | Prohibición cumplida; el 401 se resuelve con modal + `showLogin()` |

---

## Nota sobre CORS

La API pública `worldcup26.ir` no incluye el header `Access-Control-Allow-Origin`
en sus respuestas, lo que bloquea las peticiones desde el navegador. Esto es un bug
del servidor de terceros, documentado en la pestaña Network de DevTools (preflight
OPTIONS responde 204 pero sin el header requerido).

La solución implementada es un **proxy local** (`proxy-server.js`) con Node.js +
Express que reenvía las peticiones al servidor real. Las peticiones
servidor-a-servidor no están sujetas a la política CORS (exclusiva de navegadores),
por lo que el proxy puede comunicarse con la API sin restricciones y devolver la
respuesta al frontend con los headers correctos.

---

## Cómo ejecutar el proyecto

### Prerrequisitos
- Node.js 18 o superior
- Extensión **Live Server** instalada en VS Code

### Pasos

**1. Instalar dependencias del proxy:**
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

**3. Iniciar el frontend con Live Server (VS Code):**
Clic derecho en `index.html` → **Open with Live Server**  
O clic en el botón **Go Live** en la barra inferior de VS Code.

**4. Abrir la app en el navegador:**

http://127.0.0.1:5500/index.html

**5. Credenciales de prueba:**

Email:    vladimir.lab2.isw521@test.com
Password: Lab2Test2026!

> Ambos procesos (proxy en puerto 3000 y Live Server en puerto 5500) deben
> estar corriendo simultáneamente para que la app funcione.

---

## Escenarios de Resiliencia Demostrables en DevTools

| Escenario | Cómo simularlo | Comportamiento esperado |
|---|---|---|
| **401 Sesión expirada** | Modificar el token en Application → Session Storage → cambiarlo por un valor inválido → Recargar datos | Modal "Sesión expirada" sin reload |
| **500 Error de servidor** | En Network tab → clic derecho en petición `games` → Block request URL → Recargar datos | Backoff exponencial, luego caché offline con indicador amarillo |
| **429 Límite de tasa** | Misma técnica de bloqueo de URL o throttling extremo | Toast con countdown visible |
| **Offline** | Desconectar internet → Recargar datos | Datos del localStorage con banner de advertencia |