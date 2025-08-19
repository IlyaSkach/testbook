# TG Book — Telegram Mini App (EPUB‑ридер)

Телеграм‑приложение с читалкой EPUB, демо‑режимом, заявкой на покупку и админкой (ручной апрув доступа).

## 1) Предварительные требования
- Node.js 18+ и npm
- Git
- Аккаунты: Netlify (хостинг), Supabase (БД), Telegram (BotFather)
- (опц.) pandoc, unzip/zip — если будете собирать EPUB из DOCX

## 2) Клонирование и локальный запуск
```bash
git clone https://github.com/IlyaSkach/testbook.git tg-book
cd tg-book
npm install
# локально (удобно через Netlify)
npm i -g netlify-cli
netlify dev -o
```

## 3) БД Supabase
1. Создайте проект в Supabase и скопируйте `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service_role)
2. Выполните SQL из `schema.sql` (создаст `users`, `purchase_requests`, `user_access`)

## 4) Переменные окружения (Netlify)
В Netlify → Site settings → Environment variables добавьте:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PANEL_KEY` — секрет входа в админку
- `SUPPORT_USERNAME` — ник саппорта (без @)
- `PRICE_RUB` — например, `555`
- `BOT_TOKEN` (или `TELEGRAM_BOT_TOKEN`) — токен бота
- `WEBAPP_URL` — `https://<ваш-сайт>.netlify.app`

## 5) EPUB: где лежит и как заменить
- Рабочий файл: `webapp/assets/book.epub`
- Замените файл и запушьте — Netlify перезальёт приложение

### Оптимизация EPUB
- Безопасно: `npm run opt:epub` → создаст `webapp/assets/book.optimized.epub`
- Агрессивно (JPEG→WebP q70, ≤1280px; PNG без альфы→WebP): уже настроено, создаётся бэкап `book.backup.epub` и тег `before-aggressive-epub`

## 6) Бот (BotFather) и вебхук
1. @BotFather → `/newbot` → получите `BOT_TOKEN`
2. Menu Button → Set Web App → URL: `https://<ваш-сайт>.netlify.app`
3. Вебхук:
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<ваш-сайт>.netlify.app/.netlify/functions/tg-webhook"
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```
4. /start — бот пришлёт кнопку «Открыть приложение»

## 7) Админка
- URL: `/admin.html`
- Введите `ADMIN_PANEL_KEY` → «Обновить»
- В таблице: `user_id`, `@username`, статус. Кнопки: «Подтвердить» (выдать доступ), «Удалить» (каскадно удалить)

## 8) Как работает покупка/доступ
- В демо доступны 1–2 главы. Дальше — пейволл «Купить»
- По «Купить»: открывается ЛС `SUPPORT_USERNAME`, заявка создаётся в БД
- После апрува в админке (`user_access.has_full_access = true`) — полная книга

## 9) Частые проблемы
- «Не открывается чат по кнопке Купить» — убедитесь, что `SUPPORT_USERNAME` без @, бот открыт внутри Telegram. В коде есть каскад открытия (tg://, openTelegramLink, openLink, https)
- «Долгая загрузка» — уменьшайте `book.epub` (оптимизация изображений), кэш уже включён
- «Двойной тап зумит на iOS» — пофиксено (viewport, touch‑action, JS‑гард)

## 10) Структура
- Фронт: `webapp/index.html`, `webapp/assets/app.epub.js`, `webapp/assets/styles.css`
- Вендор: `webapp/assets/vendor/epub.min.js`, `webapp/assets/vendor/jszip.min.js`
- Функции (Netlify): `netlify/functions/*` — `check-access`, `create-request`, `approve-request`, `delete-user`, `list-requests`, `public-config`, `tg-webhook`
- Админка: `webapp/admin.html`
- Скрипты: `scripts/optimize-epub.cjs` (сжатие), `scripts/docx-to-epub-split.js` (если нужен конверт из DOCX)

## 11) Чек‑лист деплоя
1. Настроить переменные окружения (п.4)
2. Применить `schema.sql` в Supabase (п.3)
3. Установить вебхук бота (п.6)
4. Положить `book.epub` → `git push`
5. Открыть бота → /start → «Открыть приложение»
6. Проверить демо/покупку/админку
