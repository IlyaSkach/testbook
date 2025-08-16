# TG Book (Telegram Mini App)

Минимальное MVP: WebApp с читалкой, заявкой на покупку, админкой (ручной апрув), бот.

## Переменные окружения (Netlify)

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_PANEL_KEY (произвольный секрет для админки)

## Переменные окружения (бот)

- BOT_TOKEN — токен Telegram бота
- WEBAPP_URL — URL деплойнутого веба (например, https://your-site.netlify.app)

## Деплой

- Залейте репозиторий в Netlify (publish: `webapp`, functions: `netlify/functions`)
- Установите переменные окружения в Netlify
- Запустите бота локально: `npm i && npm run bot`

## База (Supabase)

- Выполните `schema.sql` в SQL editor Supabase
- Включите RLS off или используйте service role ключ в функциях
