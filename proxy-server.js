// proxy-server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;
const TARGET = "https://worldcup26.ir";

require("dotenv").config();
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

app.use(cors());
app.use(express.json());

// ===== ENDPOINTS DE PRUEBA PARA DEFENSA =====
app.get("/proxy/test/401", (req, res) => {
  res.status(401).json({ message: "Unauthorized" });
});
app.get("/proxy/test/500", (req, res) => {
  res.status(500).json({ message: "Internal Server Error" });
});
app.get("/proxy/test/429", (req, res) => {
  res.status(429).json({ message: "Too Many Requests" });
});

// ===== ENDPOINTS MUNDIALISTAS =====
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

// ===== CHAT CON GROQ =====
app.post("/proxy/ai/groq", async (req, res) => {
  try {
    const { messages, context } = req.body;

    const systemPrompt = `Eres un analista deportivo experto del Mundial de Futbol 2026, con profundo conocimiento tactico, historico y estadistico del futbol internacional.

DATOS REALES DISPONIBLES (usa estos como base factual):
${context}

CAPACIDADES DE ANALISIS:
Con los datos anteriores puedes responder con precision sobre:
- Goleadores individuales de cada partido (nombres y minutos)
- Resultados exactos y diferencias de goles
- Fechas y grupos de cada partido
- Rankings de goleadas (cual fue la mayor, menor, etc.)
- Comparacion entre equipos que golearon
- Impacto de cada resultado en la clasificacion del grupo
- Patrones ofensivos: equipos con mayor diferencia acumulada, equipos mas goleadores

ANALISIS TACTICO Y CONTEXTUAL:
Aunque no tengas estadisticas de pases, disparos o tarjetas de esta edicion, puedes:
- Analizar el estilo de juego tipico de cada seleccion basandote en tu conocimiento historico
- Explicar por que tacticamente un equipo pudo golear a otro (presion alta, contraataque, superioridad individual)
- Dar contexto historico: como le fue a ese equipo en mundiales anteriores
- Comparar el rendimiento actual con mundiales pasados
- Predecir posibles rivales en la siguiente fase basandote en los resultados reales
- Explicar que significa una goleada para la moral y clasificacion del equipo

REGLAS ESTRICTAS:
- Responde siempre en espanol
- Nunca inventes estadisticas que no tengas (pases, disparos, tarjetas) — si te preguntan algo que no sabes, explica que no tienes ese dato especifico pero ofrece un analisis alternativo util
- Si te preguntan sobre un equipo que no aparece en las goleadas (porque no metio 3+ goles de diferencia), explica que ese equipo no aparece en el registro de goleadas pero puedes hablar de el con conocimiento historico
- Respuestas concisas pero completas, maximo 4 parrafos
- Sin emojis
- Tono profesional de analista deportivo`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
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

// ===== CHAT CON CEREBRAS =====
app.post("/proxy/ai/cerebras", async (req, res) => {
  try {
    const { messages, context } = req.body;

    const systemPrompt = `Eres un analista experto del Mundial de Futbol 2026.
Tienes acceso a los datos reales de las goleadas del torneo (partidos finalizados con diferencia de 3 o mas goles).
Responde siempre en espanol, de forma concisa y con criterio tecnico futbolistico.
No uses emojis.

Datos actuales de las goleadas del Mundial 2026:
${context}`;

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
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

// ===== FORWARD =====
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
  console.log(`Chat IA disponible en /proxy/ai/groq y /proxy/ai/cerebras`);
});