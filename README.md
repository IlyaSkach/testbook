# TG Book — Telegram Mini App (EPUB‑ридер)

Телеграм‑приложение с читалкой EPUB, демо‑режимом, оплатой через Telegram Payments (ЮKassa), заявкой на покупку и админкой (выдача/удаление доступа).

## Что сделано сейчас
- Рендер EPUB через epub.js, белая тема (фон #FFFFFF, чёрный текст), управление шрифтом, оглавление.
- Демо‑режим: чтение до «ГЛАВА 5. ЗОЛОТОЙ ПЕРЕПЛЁТ» включительно; оглавление урезано до 5‑й; при попытке дальше — пейволл.
- Покупка: по «Купить» открывается ЛС саппорта, создаётся заявка в БД; после закрытия пейволла появляется inline‑кнопка «Купить» в футере.
- Telegram Payments (ЮKassa): endpoint для `sendInvoice`, авто‑approve `pre_checkout_query`, сообщение «Спасибо!» на `successful_payment`.
- Админка (`/admin.html`): заявки с ником, кнопки «Подтвердить» (выдаёт доступ), «Удалить» (каскад).
- Сохранение позиции (CFI+href) и резюмирование, кэширование и оптимизация EPUB, защита от двойного тапа‑зума на iOS.

---

## 1) Предварительные требования
- Node.js 18+ и npm, Git
- Аккаунты: Netlify (хостинг), Supabase (БД), Telegram (BotFather), ЮKassa (кабинет магазина)
- (опц.) pandoc, unzip/zip — если будете собирать EPUB из DOCX

## 2) Установка и локальный запуск
```bash
git clone https://github.com/IlyaSkach/testbook.git tg-book
cd tg-book
npm install
# локальная разработка через Netlify
npm i -g netlify-cli
netlify dev -o
```

## 3) БД Supabase
1) Создайте проект, возьмите `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service_role)
2) Выполните SQL `schema.sql` (создаст `users`, `purchase_requests`, `user_access`)

## 4) Переменные окружения (Netlify → Site settings → Environment variables)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PANEL_KEY` — секрет входа в админку
- `SUPPORT_USERNAME` — ник саппорта (без @)
- `PRICE_RUB` — например, `555`
- `BOT_TOKEN` (или `TELEGRAM_BOT_TOKEN`) — токен вашего бота из @BotFather
- `BOT_USERNAME` — юзернейм бота без @
- `PROVIDER_TOKEN` — (опц.) платёжный токен бота из @BotFather (ЮKassa)
- `WEBAPP_URL` — `https://<ваш-сайт>.netlify.app`

## 5) Бот и вебхук
1) @BotFather → `/newbot` → получите `BOT_TOKEN`
2) Bot Settings → Menu Button → Set Web App → URL: `https://<ваш-сайт>.netlify.app`
3) Вебхук на функции Netlify:
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<ваш-сайт>.netlify.app/.netlify/functions/tg-webhook"
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```
4) /start — бот пришлёт кнопку «Открыть приложение»

## 6) ЮKassa через Telegram Payments — как получить provider_token
1) Заказчик регистрирует магазин в ЮKassa, получает ShopID и **включает протокол API** (если не включён — попросить поддержку ЮKassa)
2) @BotFather → ваш бот → **Payments** →
   - Connect «ЮKassa: тест» — для тестовых платежей (получите **test provider_token**)
   - или Connect «ЮKassa: платежи» — для боевых
3) Авторизуйтесь у ЮKassa (бот ЮKassa), выберите магазин, выдать доступ — BotFather покажет **provider_token**
4) Сохраните его в Netlify как `PROVIDER_TOKEN` (и проверьте `BOT_TOKEN`, `BOT_USERNAME`)

### Тест оплаты
- Откройте WebApp через этого же бота → «Купить» → инвойс → оплатите тестовой картой ЮKassa
- Вебхук одобряет `pre_checkout_query` и шлёт «Спасибо!» на `successful_payment`
- Выдача доступа сейчас вручную в админке; по желанию можно включить автодоступ по `successful_payment`

## 7) EPUB: где лежит и как заменить
- Рабочий файл: `webapp/assets/book.epub`
- Замените файл и запушьте — Netlify перезальёт приложение

### Оптимизация EPUB
- Безопасно: `npm run opt:epub` → создаст `webapp/assets/book.optimized.epub`
- Агрессивно (JPEG→WebP q70, ≤1280px; PNG без альфы→WebP): скрипт `scripts/optimize-epub.cjs`, сохраняется бэкап `book.backup.epub` и тег `before-aggressive-epub`

## 8) Админка
- URL: `/admin.html` → ввести `ADMIN_PANEL_KEY` → «Обновить»
- Видно: ID заявки, user_id, @username, статус
- Кнопки: «Подтвердить» — выдать доступ; «Удалить» — удалить пользователя каскадно

## 9) Логика демо
- Доступны главы до «ГЛАВА 5. ЗОЛОТОЙ ПЕРЕПЛЁТ» включительно
- Оглавление урезано до 5‑й главы
- При попытке перейти дальше — возврат на последнюю доступную и пейволл
- После закрытия пейволла в футере появляется «Купить полную версию» (тот же сценарий, что в модалке)

## 10) Частые проблемы
- Чат не открывается по «Купить»: проверьте `SUPPORT_USERNAME` (без @), запуск **внутри Telegram**; есть каскад открытия (tg://, openTelegramLink, openLink, https)
- Инвойс не приходит: проверьте `PROVIDER_TOKEN`, `BOT_TOKEN`, `BOT_USERNAME`, webhook бота; тестируйте через «ЮKassa: тест» и тестовые карты
- Долгая загрузка: уменьшайте `book.epub` (оптимизация картинок), кэш включён, вендоры грузятся defer
- Двойной тап зумит на iOS: исправлено (viewport, touch‑action, JS‑гард)

## 11) Команды
```bash
# локальная разработка
netlify dev -o

# оптимизация EPUB
npm run opt:epub

# деплой (через подключение репозитория к Netlify)
git add -A && git commit -m "deploy" && git push
```

## 12) Структура проекта (главные файлы)
- `webapp/index.html`, `webapp/assets/app.epub.js`, `webapp/assets/styles.css`
- `webapp/assets/vendor/epub.min.js`, `webapp/assets/vendor/jszip.min.js`
- `netlify/functions/*` (серверная логика)
- `scripts/optimize-epub.cjs` (оптимизация EPUB)
- `schema.sql` (структура БД Supabase)
