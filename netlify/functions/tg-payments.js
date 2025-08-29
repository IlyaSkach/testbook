import { json, methodNotAllowed, parseJSON } from "./_utils.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}` ,{
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.ok === false) throw new Error(data?.description || "tg api error");
  return data;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return methodNotAllowed();
    if (!BOT_TOKEN) return json(500, { ok:false, error: "No BOT_TOKEN"});
    const { chat_id, title, description, payload, provider_token, currency, prices } = parseJSON(event.body);
    if (!chat_id || !provider_token || !currency || !prices?.length) return json(400, { ok:false, error: "Bad params"});
    const resp = await tg("sendInvoice", {
      chat_id,
      title: title || "Оплата доступа",
      description: description || "Полная версия книги",
      payload: payload || "access_full",
      provider_token,
      currency,
      prices,
      need_email: false,
      need_phone_number: false,
      is_flexible: false,
      max_tip_amount: 0,
      protect_content: false,
    });
    return json(200, { ok:true, result: resp?.result });
  } catch (e) {
    return json(500, { ok:false, error: e.message });
  }
};


