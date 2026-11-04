#!/bin/zsh
set -euo pipefail
cd -- "${0:A:h}"
swift build -c release
bundle="$PWD/build/ShareFrame.app"
mkdir -p "$bundle/Contents/MacOS"
cp .build/release/ShareFrame "$bundle/Contents/MacOS/ShareFrame"
cp Info.plist "$bundle/Contents/Info.plist"
# Prefer a local signing identity for stable screen-recording permission across
# rebuilds. Ad-hoc signing keeps a first build runnable without Xcode setup.
identity="${SHAREFRAME_SIGN_IDENTITY:--}"
codesign --force --sign "$identity" "$bundle"
printf '\nApp: %s\nLaunch: open "%s"\n' "$bundle" "$bundle"
