/**
 * NubePOS · api/notify-telegram.js
 * -----------------------------------------------------------------------
 * Función serverless (formato Netlify Functions) que recibe el detalle de
 * un pedido desde app-cliente.js y lo reenvía a un canal/chat de Telegram
 * usando la Bot API.
 *
 * SEGURIDAD: el Bot Token y el Chat ID viven SOLO como variables de
 * entorno del proveedor (Netlify/Vercel), nunca en el bundle del cliente.
 *
 *   TELEGRAM_BOT_TOKEN   -> token del bot, obtenido de @BotFather
 *   TELEGRAM_CHAT_ID     -> chat/canal/grupo donde se notifican los pedidos
 *   ALLOWED_ORIGIN        -> (opcional) origen permitido para CORS,
 *                            ej. "https://menu.mi-negocio.com"
 *
 * Configuralas una sola vez en el panel del proveedor:
 *   Netlify -> Site settings > Environment variables
 *   Vercel  -> Project settings > Environment Variables
 *
 * Despliegue:
 *   - Netlify: colocar este archivo en `netlify/functions/notify-telegram.js`
 *     (o configurar `functions = "api"` en netlify.toml) y exponer
 *     `exports.handler` como se hace abajo.
 *   - Vercel: renombrar el hook exportado a `export default async function
 *     handler(req, res) {...}` (variante comentada al final del archivo).
 * -----------------------------------------------------------------------
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

/** Arma un mensaje legible en Markdown para Telegram a partir del pedido. */
function buildMessage({ pedidoId, negocioId, items = [], total, cliente }) {
  const lineas = items
    .map((it) => `• ${it.cantidad}x ${escapeMarkdown(it.nombre || "producto")}`)
    .join("\n");

  const clienteLinea = cliente?.nombre ? `\n👤 Cliente: ${escapeMarkdown(cliente.nombre)}` : "";

  return [
    `🧾 *Nuevo pedido* ${negocioId ? `· _${escapeMarkdown(negocioId)}_` : ""}`,
    `🆔 ${escapeMarkdown(pedidoId || "s/n")}`,
    "",
    lineas || "_(sin ítems)_",
    "",
    `💰 Total: *Bs ${Number(total || 0).toFixed(2)}*${clienteLinea}`,
  ].join("\n");
}

function escapeMarkdown(text = "") {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function jsonResponse(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

function corsHeaders() {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/** Validación mínima del payload recibido desde el cliente. */
function validatePayload(body) {
  if (!body || typeof body !== "object") return "Cuerpo de la solicitud inválido.";
  if (!Array.isArray(body.items) || body.items.length === 0) return "El pedido no tiene ítems.";
  if (typeof body.total !== "number" || body.total < 0) return "El total del pedido es inválido.";
  return null;
}

/* ------------------------------- Netlify -------------------------------- */
exports.handler = async function handler(event) {
  const headers = corsHeaders();

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método no permitido. Usá POST." }, headers);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("[notify-telegram] faltan variables de entorno TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
    return jsonResponse(500, { error: "El servicio de notificaciones no está configurado todavía." }, headers);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "JSON inválido en el cuerpo de la solicitud." }, headers);
  }

  const validationError = validatePayload(body);
  if (validationError) {
    return jsonResponse(400, { error: validationError }, headers);
  }

  const text = buildMessage(body);
  const telegramUrl = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

  try {
    const telegramResponse = await fetchWithTimeout(
      telegramUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      },
      8000
    );

    const telegramData = await telegramResponse.json().catch(() => ({}));

    if (!telegramResponse.ok || telegramData.ok === false) {
      console.error("[notify-telegram] Telegram respondió con error:", telegramData);
      return jsonResponse(
        502,
        { error: "Telegram rechazó la notificación.", detail: telegramData.description || null },
        headers
      );
    }

    return jsonResponse(200, { ok: true, telegramMessageId: telegramData.result?.message_id || null }, headers);
  } catch (err) {
    // Cubre timeouts y caídas de red hacia la API de Telegram, para que el
    // frontend pueda mostrar un fallback amigable en vez de colgarse.
    console.error("[notify-telegram] fallo de red hacia Telegram:", err);
    return jsonResponse(504, { error: "No se pudo contactar a Telegram. Intentá de nuevo en unos segundos." }, headers);
  }
};

/** fetch con timeout manual, ya que algunos runtimes serverless no cortan
 *  solicitudes colgadas por sí solos. */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------------- *
 * Variante para Vercel (Serverless Functions / Edge no-streaming):
 * reemplazar el bloque `exports.handler` de arriba por esto y ajustar el
 * archivo a `api/notify-telegram.js` en la raíz del proyecto Vercel.
 *
 * export default async function handler(req, res) {
 *   if (req.method === "OPTIONS") return res.status(204).end();
 *   if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
 *
 *   const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
 *   if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
 *     return res.status(500).json({ error: "Notificaciones no configuradas." });
 *   }
 *
 *   const validationError = validatePayload(req.body);
 *   if (validationError) return res.status(400).json({ error: validationError });
 *
 *   const text = buildMessage(req.body);
 *   const tgRes = await fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" }),
 *   });
 *   const data = await tgRes.json().catch(() => ({}));
 *   if (!tgRes.ok || data.ok === false) {
 *     return res.status(502).json({ error: "Telegram rechazó la notificación." });
 *   }
 *   return res.status(200).json({ ok: true, telegramMessageId: data.result?.message_id || null });
 * }
 * --------------------------------------------------------------------- */
