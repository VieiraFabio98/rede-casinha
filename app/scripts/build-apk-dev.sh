#!/usr/bin/env bash
# Gera o APK de desenvolvimento (Rede Casinha (dev)) com pouca memória:
# só arm64, 2 núcleos e 1 worker. Leva ~8 min na primeira vez e cabe num WSL de 8 GB.
# Depois: adb install -r android/app/build/outputs/apk/debug/app-debug.apk
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d android ] || APP_VARIANT=development npx expo prebuild -p android
cd android
taskset -c 0-1 ./gradlew assembleDebug --console=plain --no-daemon --max-workers=1 \
  -Dorg.gradle.jvmargs="-Xmx1536m -XX:MaxMetaspaceSize=512m" \
  -Dorg.gradle.parallel=false \
  -Pkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=arm64-v8a
echo "APK: $(pwd)/app/build/outputs/apk/debug/app-debug.apk"
