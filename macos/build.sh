#!/usr/bin/env bash
# Builds "Raindrop Admin Panel.app" into ~/Applications, pointing at this project folder.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
APP="$HOME/Applications/Raindrop Admin Panel.app"

command -v swiftc >/dev/null || { echo "swiftc not found. Install Xcode Command Line Tools: xcode-select --install"; exit 1; }
[ -d node_modules ] || npm install

echo "▌ building launcher…"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O macos/main.swift -o "$APP/Contents/MacOS/launch"
cp macos/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Raindrop Admin Panel</string>
  <key>CFBundleDisplayName</key><string>Raindrop Admin Panel</string>
  <key>CFBundleIdentifier</key><string>io.github.raindrop-bookmark-admin-panel</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
  <key>PanelRoot</key><string>${ROOT}</string>
</dict>
</plist>
PLIST

codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true
echo "▌ done: $APP"
echo "▌ open it from Spotlight (⌘ Space → \"bookmark admin\") or drag it to your Dock."
