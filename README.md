# Yarik

## 1. Проверить у себя (без Telegram)
cd server && npm install && npm start  → откройте http://localhost:3000.
Код входа печатается в консоли сервера.

## 2. Боевой запуск
1. Получите токен на gateway.telegram.org, пополните баланс.
2. Разместите папку server на Railway / Fly.io / VPS (нужен Node 18+ и HTTPS).
3. Переменные: GATEWAY_TOKEN=<токен>, DATA_DIR=<папка на постоянном диске>.
   Без постоянного диска база (data.json) стирается при перезапуске.

## 3. Собрать Yarik.exe
1. В desktop/config.json впишите адрес сервера: {"server":"https://ваш-адрес"}.
2. Вариант А (без установки чего-либо): залейте проект на GitHub → Actions → Build Yarik.exe → Run → скачайте Yarik-exe.
   Вариант Б (на Windows с Node): cd desktop && npm install && npm run dist → desktop/dist/Yarik.exe.
Друзья без exe могут открыть тот же адрес в браузере, в том числе с телефона.
