// js/chat.js
// Módulo del chat flotante con IA (Groq y Cerebras).
// Mantiene historial de conversación y contexto de las goleadas.

const BASE_PROXY = "http://localhost:3000/proxy";

let historial = [];
let contextoGoleadas = "";
let modeloActual = "groq";
let chatAbierto = false;

// ===== INICIALIZAR CON CONTEXTO DE GOLEADAS =====
function inicializarChat(goleadas) {
  if (!goleadas || goleadas.length === 0) {
    contextoGoleadas = "No hay goleadas disponibles aun.";
    return;
  }

  contextoGoleadas = goleadas
    .map((p, i) => {
      const local     = p.equipoLocal?.name_en || p.home_team_id;
      const visitante = p.equipoVisitante?.name_en || p.away_team_id;
      const fecha     = p.local_date
        ? new Date(p.local_date).toLocaleDateString("es-CR", {
            day: "2-digit", month: "short", year: "numeric",
          })
        : "Fecha desconocida";

      // Parsear goleadores — vienen como string tipo '{"Jugador 27\'","Jugador 75\'"}'
      const parsearGoleadores = (raw) => {
        if (!raw || raw === "null" || raw === "NULL") return "No disponible";
        try {
          const limpio = raw
            .replace(/^\{/, "")
            .replace(/\}$/, "")
            .split(",")
            .map((g) => g.replace(/"/g, "").trim())
            .filter(Boolean)
            .join(", ");
          return limpio || "No disponible";
        } catch {
          return "No disponible";
        }
      };

      const goleadoresLocal     = parsearGoleadores(p.home_scorers);
      const goleadoresVisitante = parsearGoleadores(p.away_scorers);

      return `${i + 1}. ${local} ${p.home_score}-${p.away_score} ${visitante}
   Diferencia: ${p.diferencia} goles | Fecha: ${fecha} | Grupo: ${p.group || "N/A"}
   Goleadores ${local}: ${goleadoresLocal}
   Goleadores ${visitante}: ${goleadoresVisitante}`;
    })
    .join("\n\n");

  historial = [];
}

// ===== CONSTRUIR UI =====
function construirChatUI() {
  const wrapper = document.createElement("div");
  wrapper.id = "chat-wrapper";
  wrapper.innerHTML = `
    <button id="chat-toggle-btn" class="chat-toggle-btn" title="Analista IA del Mundial">
      Analista IA
    </button>

    <div id="chat-panel" class="chat-panel hidden">
      <div class="chat-header">
        <span class="chat-title">Analista IA - Mundial 2026</span>
        <div class="chat-header-actions">
          <select id="modelo-select" class="modelo-select">
            <option value="groq">Groq (Llama 3.3)</option>
            <option value="cerebras">Cerebras (Llama 3.3)</option>
          </select>
          <button id="chat-clear-btn" class="chat-clear-btn" title="Limpiar conversacion">Limpiar</button>
          <button id="chat-close-btn" class="chat-close-btn" title="Cerrar">X</button>
        </div>
      </div>

      <div id="chat-messages" class="chat-messages">
        <div class="chat-msg assistant">
          Hola. Soy tu analista del Mundial 2026. Tengo acceso a todas las goleadas del torneo. Puedes preguntarme sobre equipos, resultados, estadisticas o cualquier analisis que necesites.
        </div>
      </div>

      <div class="chat-input-area">
        <textarea
          id="chat-input"
          class="chat-input"
          placeholder="Pregunta sobre los partidos..."
          rows="2"
        ></textarea>
        <button id="chat-send-btn" class="chat-send-btn">Enviar</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  registrarEventosChat();
}

// ===== EVENTOS =====
function registrarEventosChat() {
  const toggleBtn  = document.getElementById("chat-toggle-btn");
  const panel      = document.getElementById("chat-panel");
  const closeBtn   = document.getElementById("chat-close-btn");
  const clearBtn   = document.getElementById("chat-clear-btn");
  const sendBtn    = document.getElementById("chat-send-btn");
  const inputEl    = document.getElementById("chat-input");
  const modeloSel  = document.getElementById("modelo-select");

  toggleBtn.addEventListener("click", () => {
    chatAbierto = !chatAbierto;
    panel.classList.toggle("hidden", !chatAbierto);
    if (chatAbierto) {
      inputEl.focus();
      scrollAlFinal();
    }
  });

  closeBtn.addEventListener("click", () => {
    chatAbierto = false;
    panel.classList.add("hidden");
  });

  clearBtn.addEventListener("click", () => {
    historial = [];
    const mensajes = document.getElementById("chat-messages");
    mensajes.innerHTML = `
      <div class="chat-msg assistant">
        Conversacion reiniciada. Puedes hacerme nuevas preguntas sobre el Mundial 2026.
      </div>
    `;
  });

  modeloSel.addEventListener("change", () => {
    modeloActual = modeloSel.value;
  });

  sendBtn.addEventListener("click", () => enviarMensaje());

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });
}

// ===== ENVIAR MENSAJE =====
async function enviarMensaje() {
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  const texto   = inputEl.value.trim();

  if (!texto) return;

  inputEl.value = "";
  sendBtn.disabled = true;

  agregarMensajeUI("user", texto);
  historial.push({ role: "user", content: texto });

  const typingId = agregarTypingIndicator();

  try {
    const endpoint = modeloActual === "groq"
      ? `${BASE_PROXY}/ai/groq`
      : `${BASE_PROXY}/ai/cerebras`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: historial,
        context: contextoGoleadas,
      }),
    });

    const data = await response.json();
    eliminarTypingIndicator(typingId);

    if (!response.ok) {
      agregarMensajeUI("error", `Error del modelo: ${data.error || "respuesta invalida"}`);
      return;
    }

    const reply = data.reply;
    historial.push({ role: "assistant", content: reply });
    agregarMensajeUI("assistant", reply);

  } catch (err) {
    eliminarTypingIndicator(typingId);
    agregarMensajeUI("error", "No se pudo conectar con el modelo. Verifica que el proxy este corriendo.");
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ===== UI HELPERS =====
function agregarMensajeUI(role, texto) {
  const mensajes = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.textContent = texto;
  mensajes.appendChild(div);
  scrollAlFinal();
}

function agregarTypingIndicator() {
  const mensajes = document.getElementById("chat-messages");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "chat-msg assistant typing";
  div.textContent = "Escribiendo...";
  mensajes.appendChild(div);
  scrollAlFinal();
  return id;
}

function eliminarTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollAlFinal() {
  const mensajes = document.getElementById("chat-messages");
  if (mensajes) mensajes.scrollTop = mensajes.scrollHeight;
}

export { inicializarChat, construirChatUI };