// js/chat.js
// Chat IA flotante — universal para los 5 subproyectos
// Contexto se inyecta desde main.js con datos reales del torneo

const BASE_PROXY = "http://localhost:3000/proxy";

let historial      = [];
let contextoActual = "";
let modeloActual   = "groq";
let chatAbierto    = false;

function inicializarChat(contexto) {
  contextoActual = contexto || "";
}

function construirChatUI() {
  const wrapper = document.createElement("div");
  wrapper.id    = "chat-wrapper";
  wrapper.innerHTML = `
    <button id="chat-toggle-btn" class="chat-toggle-btn">Analista IA</button>
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
          Hola. Soy tu analista del Mundial 2026. Tengo acceso a datos de goleadas, estadios y mas. Puedes preguntarme sobre cualquier pantalla del sistema.
        </div>
      </div>
      <div class="chat-input-area">
        <textarea id="chat-input" class="chat-input" placeholder="Pregunta sobre el Mundial..." rows="2"></textarea>
        <button id="chat-send-btn" class="chat-send-btn">Enviar</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  const toggleBtn  = document.getElementById("chat-toggle-btn");
  const panel      = document.getElementById("chat-panel");
  const closeBtn   = document.getElementById("chat-close-btn");
  const clearBtn   = document.getElementById("chat-clear-btn");
  const sendBtn    = document.getElementById("chat-send-btn");
  const inputEl    = document.getElementById("chat-input");
  const mensajesEl = document.getElementById("chat-messages");
  const modeloSel  = document.getElementById("modelo-select");

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

  sendBtn.addEventListener("click", () => enviarMensaje(mensajesEl, inputEl, sendBtn));

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje(mensajesEl, inputEl, sendBtn);
    }
  });
}

async function enviarMensaje(mensajesEl, inputEl, sendBtn) {
  const texto = inputEl.value.trim();
  if (!texto) return;

  inputEl.value    = "";
  sendBtn.disabled = true;

  agregarMensaje(mensajesEl, "user", texto);
  historial.push({ role: "user", content: texto });

  const typingId = agregarTyping(mensajesEl);

  try {
    const endpoint = modeloActual === "groq"
      ? `${BASE_PROXY}/ai/groq`
      : `${BASE_PROXY}/ai/cerebras`;

    const response = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ messages: historial, context: contextoActual }),
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
  const div       = document.createElement("div");
  div.className   = `chat-msg ${role}`;
  div.textContent = texto;
  contenedor.appendChild(div);
  scrollAlFinal(contenedor);
}

function agregarTyping(contenedor) {
  const id      = "typing-" + Date.now();
  const div     = document.createElement("div");
  div.id        = id;
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

export { inicializarChat, construirChatUI };