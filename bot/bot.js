import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL; // e.g., https://your-site.netlify.app

if (!token) {
  console.error("BOT_TOKEN is not set");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "Открыть книгу", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Читать в мини‑приложении", web_app: { url: webAppUrl } }],
      ],
    },
  });
});

bot.on("message", async (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    await bot.sendMessage(msg.chat.id, "Нажмите кнопку, чтобы открыть WebApp");
  }
});
