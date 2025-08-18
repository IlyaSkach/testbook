import { json, methodNotAllowed, parseJSON } from "./_utils.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://booktesting.netlify.app";

async function tg(method, payload) {
  if (!BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.description || `TG API error: ${res.status}`);
  }
  return data;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const update = parseJSON(event.body);
    const msg = update?.message || update?.edited_message || null;
    if (!msg) return json(200, { ok: true });

    const chatId = msg.chat?.id;
    const text = (msg.text || "").trim();
    if (!chatId) return json(200, { ok: true });

    if (/^\/start/i.test(text)) {
      const reply_markup = {
        inline_keyboard: [
          [
            {
              text: "Открыть приложение",
              web_app: { url: WEBAPP_URL },
            },
          ],
        ],
      };
      await tg("sendMessage", {
        chat_id: chatId,
        text: "Добро пожаловать в RizyLand! Откройте приложение кнопкой ниже. Если кнопка не работает, используйте меню бота → WebApp.",
        reply_markup,
      });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(200, { ok: false, error: e.message });
  }
};
