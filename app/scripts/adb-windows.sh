#!/usr/bin/env bash
# Caminho do adb.exe do Windows (Android SDK), usado quando o celular está no cabo:
# o WSL não enxerga USB, mas consegue executar o adb do Windows. Sobrescreva com ADB=...
if [ -z "${ADB:-}" ]; then
  LOCALAPPDATA_WIN=$(cmd.exe /c 'echo %LOCALAPPDATA%' 2>/dev/null | tr -d '\r')
  ADB="$(wslpath "$LOCALAPPDATA_WIN")/Android/Sdk/platform-tools/adb.exe"
fi
[ -x "$ADB" ] || { echo "adb.exe não encontrado em $ADB (defina ADB=...)"; exit 1; }
export ADB
