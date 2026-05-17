#!/bin/bash

cd "$(dirname "$0")"

PORT_SERVER=3005
PORT_CLIENT=5175   # Vite по умолчанию
HOST=0.0.0.0

IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)

clear
echo "======================================"
echo " 🎬 Movie Watcher App"
echo "======================================"
echo " 🌐 LAN IP: $IP"
echo " 🖥  Server: http://$IP:$PORT_SERVER"
echo " 💻 Client: http://$IP:$PORT_CLIENT"
echo " ⛔ Остановка: Ctrl+C"
echo "======================================"
echo ""

# Экспортируем HOST, чтобы npm dev-серверы слушали 0.0.0.0
export HOST=0.0.0.0

# SERVER
(
  cd server || exit 1
  npm run dev -- --host 0.0.0.0
) &

# CLIENT (Vite)
(
  cd client || exit 1
  npm run dev -- --host 0.0.0.0
) &

wait
