#!/usr/bin/env bash
# Liga o celular (no cabo, via adb do Windows) à API e ao Metro que rodam no WSL.
# Deixe este terminal aberto enquanto testa. Antes: API (npm run start:dev) e Metro (npm start).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/adb-windows.sh

"$ADB" devices | tr -d '\r' | grep -q "device$" || { echo "Nenhum celular autorizado no adb. Confira o cabo e a depuração USB."; exit 1; }
# O celular acessa localhost:8081/3000 → Windows 127.0.0.1:18081/13000 → ponte no WSL → Metro/API.
"$ADB" reverse tcp:8081 tcp:18081 >/dev/null
"$ADB" reverse tcp:3000 tcp:13000 >/dev/null
echo "Portas ligadas. Abra o app Rede Casinha (dev) no celular."
exec node scripts/ponte-wsl.mjs
