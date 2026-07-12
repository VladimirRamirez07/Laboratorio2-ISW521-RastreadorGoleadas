// js/chat.js
// Módulo de chat IA — funciona tanto flotante (dashboard) como pantalla completa.

const BASE_PROXY = "http://localhost:3000/proxy";

let historial = [];
let contextoGoleadas = "";
let modeloActual = "groq";
let chatAbierto = false;

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

      const parsearGoleadores = (raw) => {
        if (!raw || raw === "null" || raw === "NULL") return "No disponible";
        try {
          return raw
            .replace(/^\{/, "").replace(/\}$/, "")
            .split(",")
            .map((g) => g.replace(/"/g, "").trim())
            .filter(Boolean)
            .join(", ") || "No disponible";
        } catch { return "No disponible"; }
      };

      return `${i + 1}. ${local} ${p.home_score}-${p.away_score} ${visitante}
   Diferencia: ${p.diferencia} goles | Fecha: ${fecha} | Grupo: ${p.group || "N/A"}
   Goleadores ${local}: ${parsearGoleadores(p.home_scorers)}
   Goleadores ${visitante}: ${parsearGoleadores(p.away_scorers)}`;
    })
    .join("\n\n");

  historial = [];
}

// ===== CHAT FLOTANTE (dashboard) =====
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
          <button id="chat-clear-btn" class="chat-clear-btn">Limpiar</button>
          <button id="chat-close-btn" class="chat-close-btn">X</button>
        </div>
      </div>
      <div id="chat-messages" class="chat-messages">
        <div class="chat-msg assistant">
          Hola. Soy tu analista del Mundial 2026. Tengo acceso a todas las goleadas del torneo.
        </div>
      </div>
      <div class="chat-input-area">
        <textarea id="chat-input" class="chat-input" placeholder="Pregunta sobre los partidos..." rows="2"></textarea>
        <button id="chat-send-btn" class="chat-send-btn">Enviar</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  registrarEventosChat("chat-messages", "chat-input", "chat-send-btn", "chat-toggle-btn", "chat-panel", "chat-close-btn", "chat-clear-btn", "modelo-select");
}

// ===== CHAT PANTALLA COMPLETA (pantalla Analista IA) =====
function inicializarChatPantallaCompleta() {
  const mensajesEl = document.getElementById("ia-chat-messages");
  const inputEl    = document.getElementById("ia-chat-input");
  const sendBtn    = document.getElementById("ia-chat-send-btn");
  const clearBtn   = document.getElementById("ia-chat-clear-btn");
  const modeloSel  = document.getElementById("ia-modelo-select");

  if (!mensajesEl) return;

  clearBtn.addEventListener("click", () => {
    historial = [];
    mensajesEl.innerHTML = `<div class="chat-msg assistant">Conversacion reiniciada. Puedes hacerme nuevas preguntas sobre el Mundial 2026.</div>`;
  });

  modeloSel.addEventListener("change", () => {
    modeloActual = modeloSel.value;
  });

  sendBtn.addEventListener("click", () => enviarMensajeEn(mensajesEl, inputEl, sendBtn));

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensajeEn(mensajesEl, inputEl, sendBtn);
    }
  });
}

function registrarEventosChat(mensajesId, inputId, sendId, toggleId, panelId, closeId, clearId, modeloId) {
  const toggleBtn = document.getElementById(toggleId);
  const panel     = document.getElementById(panelId);
  const closeBtn  = document.getElementById(closeId);
  const clearBtn  = document.getElementById(clearId);
  const sendBtn   = document.getElementById(sendId);
  const inputEl   = document.getElementById(inputId);
  const modeloSel = document.getElementById(modeloId);
  const mensajesEl = document.getElementById(mensajesId);

  toggleBtn.addEventListener("click", () => {
    chatAbierto = !chatAbierto;
    panel.classList.toggle("hidden", !chatAbierto);
    if (chatAbierto) { inputEl.focus(); scrollAlFinal(mensajesEl); }
  });

  closeBtn.addEventListener("click", () => {
    chatAbierto = false;
    panel.classList.add("hidden");
  });

  clearBtn.addEventListener("click", () => {
    historial = [];
    mensajesEl.innerHTML = `<div class="chat-msg assistant">Conversacion reiniciada.</div>`;
  });

  modeloSel.addEventListener("change", () => { modeloActual = modeloSel.value; });

  sendBtn.addEventListener("click", () => enviarMensajeEn(mensajesEl, inputEl, sendBtn));

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensajeEn(mensajesEl, inputEl, sendBtn);
    }
  });
}

async function enviarMensajeEn(mensajesEl, inputEl, sendBtn) {
  const texto = inputEl.value.trim();
  if (!texto) return;

  inputEl.value = "";
  sendBtn.disabled = true;

  agregarMensaje(mensajesEl, "user", texto);
  historial.push({ role: "user", content: texto });

  const typingId = agregarTyping(mensajesEl);

  try {
    const endpoint = modeloActual === "groq"
      ? `${BASE_PROXY}/ai/groq`
      : `${BASE_PROXY}/ai/cerebras`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: historial, context: contextoGoleadas }),
    });

    const data = await response.json();
    eliminarTyping(mensajesEl, typingId);

    if (!response.ok) {
      agregarMensaje(mensajesEl, "error", `Error del modelo: ${data.error || "respuesta invalida"}`);
      return;
    }

    historial.push({ role: "assistant", content: data.reply });
    agregarMensaje(mensajesEl, "assistant", data.reply);

  } catch {
    eliminarTyping(mensajesEl, typingId);
    agregarMensaje(mensajesEl, "error", "No se pudo conectar con el modelo. Verifica que el proxy este corriendo.");
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function agregarMensaje(contenedor, role, texto) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.textContent = texto;
  contenedor.appendChild(div);
  scrollAlFinal(contenedor);
}

function agregarTyping(contenedor) {
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "chat-msg assistant typing";
  div.textContent = "Escribiendo...";
  contenedor.appendChild(div);
  scrollAlFinal(contenedor);
  return id;
}

function eliminarTyping(contenedor, id) {
  const el = contenedor.querySelector(`#${id}`);
  if (el) el.remove();
}

function scrollAlFinal(contenedor) {
  if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
}

export { inicializarChat, construirChatUI, inicializarChatPantallaCompleta };