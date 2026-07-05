// proxy-server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;
const TARGET = "https://worldcup26.ir";

app.use(cors());
app.use(express.json());

// ===== ENDPOINTS DE PRUEBA PARA DEFENSA TÉCNICA =====

// Simula un 401 real para demostrar el manejo de sesión expirada
app.get("/proxy/test/401", (req, res) => {
  res.status(401).json({ message: "Unauthorized - sesión expirada" });
});

// Simula un 500 real para demostrar el backoff exponencial
app.get("/proxy/test/500", (req, res) => {
  res.status(500).json({ message: "Internal Server Error - error del servidor" });
});

// Simula un 429 real para demostrar el countdown del backoff
app.get("/proxy/test/429", (req, res) => {
  res.status(429).json({ message: "Too Many Requests - límite de peticiones" });
});

// ===== ENDPOINTS REALES =====

app.post("/proxy/auth/register", async (req, res) => {
  await forward(req, res, "/auth/register", "POST");
});

app.post("/proxy/auth/authenticate", async (req, res) => {
  await forward(req, res, "/auth/authenticate", "POST");
});

app.get("/proxy/get/games", async (req, res) => {
  await forward(req, res, "/get/games", "GET");
});

app.get("/proxy/get/teams", async (req, res) => {
  await forward(req, res, "/get/teams", "GET");
});

async function forward(req, res, path, method) {
  try {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    };

    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    const options = { method, headers };

    if (method === "POST") {
      options.body = JSON.stringify(req.body);
    }

    const apiResponse = await fetch(`${TARGET}${path}`, options);

    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");

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
  console.log(`Endpoints de prueba disponibles:`);
  console.log(`  GET http://localhost:${PORT}/proxy/test/401`);
  console.log(`  GET http://localhost:${PORT}/proxy/test/500`);
  console.log(`  GET http://localhost:${PORT}/proxy/test/429`);
});