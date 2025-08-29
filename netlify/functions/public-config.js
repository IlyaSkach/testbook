import { json } from "./_utils.js";

export const handler = async () => {
  const support = process.env.SUPPORT_USERNAME || "SkIlyaA";
  const price = Number(process.env.PRICE_RUB || 555);
  const botUsername = process.env.BOT_USERNAME || ""; // для открытия чата бота
  const currency = "RUB";
  return json(200, { ok: true, support_username: support, price_rub: price, bot_username: botUsername, currency });
};
