#!/usr/bin/env bash
# Instala o APK de desenvolvimento no celular do cabo (adb do Windows).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/adb-windows.sh
"$ADB" install -r "$(wslpath -w android/app/build/outputs/apk/debug/app-debug.apk)"
