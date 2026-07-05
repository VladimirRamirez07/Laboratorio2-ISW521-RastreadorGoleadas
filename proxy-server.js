// proxy-server.js
// Servidor proxy local: reenvía peticiones a worldcup26.ir y agrega
// el header CORS que la API pública no está devolviendo (bug del lado del servidor).
// Las peticiones servidor-a-servidor no están sujetas a CORS, por eso este
// proxy puede hablar con la API sin problema y luego responderle al
// frontend con los headers correctos.

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;
const TARGET = "https://worldcup26.ir";

app.use(cors()); // permite cualquier origin hacia este proxy (uso local de desarrollo)
app.use(express.json());

// --- AUTH: registro (no la usamos desde la app, pero la dejamos disponible) ---
app.post("/proxy/auth/register", async (req, res) => {
  await forward(req, res, "/auth/register", "POST");
});

// --- AUTH: login ---
app.post("/proxy/auth/authenticate", async (req, res) => {
  await forward(req, res, "/auth/authenticate", "POST");
});

// --- DATOS: partidos ---
app.get("/proxy/get/games", async (req, res) => {
  await forward(req, res, "/get/games", "GET");
});

// --- DATOS: equipos ---
app.get("/proxy/get/teams", async (req, res) => {
  await forward(req, res, "/get/teams", "GET");
});

/**
 * Reenvía la petición original hacia la API real, preservando
 * el header Authorization (JWT) cuando viene presente, y el body
 * en peticiones POST.
 */
async function forward(req, res, path, method) {
  try {
    const headers = { "Content-Type": "application/json" };

    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    const options = { method, headers };

    if (method === "POST") {
      options.body = JSON.stringify(req.body);
    }

    const apiResponse = await fetch(`${TARGET}${path}`, options);
    const data = await apiResponse.json().catch(() => null);

    res.status(apiResponse.status).json(data);
  } catch (error) {
    console.error(`Error en proxy hacia ${path}:`, error.message);
    res.status(500).json({ error: "Error interno del proxy" });
  }
}

app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT}`);
  console.log(`Reenviando peticiones hacia ${TARGET}`);
});