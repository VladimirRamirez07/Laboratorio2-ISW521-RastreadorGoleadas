// proxy-server.js
// Proxy local Node.js + Express — resuelve CORS de worldcup26.ir
// Endpoints: games, teams, stadiums, groups, IA (Groq + Cerebras), tests de resiliencia

require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app    = express();
const PORT   = 3000;
const TARGET = "https://worldcup26.ir";

app.use(cors());
app.use(express.json());

// ===== HELPER FORWARD =====
async function forward(req, res, path, method = "GET") {
  try {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Pragma":        "no-cache",
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

// ===== ENDPOINTS DE DATOS =====

app.get("/proxy/get/games", (req, res) => {
  forward(req, res, "/get/games");
});

app.get("/proxy/get/teams", (req, res) => {
  forward(req, res, "/get/teams");
});

app.get("/proxy/get/stadiums", (req, res) => {
  forward(req, res, "/get/stadiums");
});

app.get("/proxy/get/groups", (req, res) => {
  forward(req, res, "/get/groups");
});

// ===== AUTENTICACION =====

app.post("/proxy/auth/register", (req, res) => {
  forward(req, res, "/auth/register", "POST");
});

app.post("/proxy/auth/authenticate", (req, res) => {
  forward(req, res, "/auth/authenticate", "POST");
});

// ===== TESTS DE RESILIENCIA =====

app.get("/proxy/test/500", (req, res) => {
  res.status(500).json({ error: "Error 500 simulado para prueba de resiliencia" });
});

app.get("/proxy/test/429", (req, res) => {
  res.status(429).json({ error: "Error 429 simulado para prueba de resiliencia" });
});

// ===== CHAT IA — GROQ =====

app.post("/proxy/ai/groq", async (req, res) => {
  const { messages, context } = req.body;
  try {
    const systemPrompt = context
      ? `Eres un analista experto del Mundial 2026. Tienes acceso a datos reales del torneo.\n\nContexto actual:\n${context}\n\nResponde siempre en espanol.`
      : "Eres un analista experto del Mundial 2026. Responde siempre en espanol.";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Error de Groq" });
    }
    res.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error("Error Groq:", error.message);
    res.status(500).json({ error: "Error interno al llamar a Groq" });
  }
});

// ===== CHAT IA — CEREBRAS =====

app.post("/proxy/ai/cerebras", async (req, res) => {
  const { messages, context } = req.body;
  try {
    const systemPrompt = context
      ? `Eres un analista experto del Mundial 2026. Tienes acceso a datos reales del torneo.\n\nContexto actual:\n${context}\n\nResponde siempre en espanol.`
      : "Eres un analista experto del Mundial 2026. Responde siempre en espanol.";

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Error de Cerebras" });
    }
    res.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error("Error Cerebras:", error.message);
    res.status(500).json({ error: "Error interno al llamar a Cerebras" });
  }
});

// ===== ARRANQUE =====

app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT}`);
  console.log(`Reenviando peticiones hacia ${TARGET}`);
  console.log(`  GET  /proxy/get/games`);
  console.log(`  GET  /proxy/get/teams`);
  console.log(`  GET  /proxy/get/stadiums`);
  console.log(`  GET  /proxy/get/groups`);
  console.log(`  GET  /proxy/test/500`);
  console.log(`  GET  /proxy/test/429`);
  console.log(`  POST /proxy/ai/groq`);
  console.log(`  POST /proxy/ai/cerebras`);
});