#!/bin/bash
set -e

# --- CONFIG ---
ELECTRON_VERSION="v22.3.27"
ELECTRON_DIR="$HOME/.local/electron-$ELECTRON_VERSION"
ELECTRON_BIN="$ELECTRON_DIR/electron"
DOWNLOAD_URL="https://github.com/electron/electron/releases/download/$ELECTRON_VERSION/electron-$ELECTRON_VERSION-linux-x64.zip"
VERSION_URL="https://raw.githubusercontent.com/realdtn2/zalo-linux-port-2026/master/version.txt"
INSTALL_DIR="$(dirname "$0")"

# --- DOWNLOAD ELECTRON IF NOT EXISTS ---
if [ ! -f "$ELECTRON_BIN" ]; then
    echo "[*] Electron $ELECTRON_VERSION not found. Downloading..."

    TMP_ZIP="/tmp/electron-$ELECTRON_VERSION.zip"

    wget -O "$TMP_ZIP" "$DOWNLOAD_URL"

    mkdir -p "$ELECTRON_DIR"
    unzip -q "$TMP_ZIP" -d "$ELECTRON_DIR"

    if [ -d "$ELECTRON_DIR/electron-$ELECTRON_VERSION-linux-x64" ]; then
        mv "$ELECTRON_DIR"/electron-$ELECTRON_VERSION-linux-x64/* "$ELECTRON_DIR"
        rmdir "$ELECTRON_DIR/electron-$ELECTRON_VERSION-linux-x64"
    fi

    rm "$TMP_ZIP"
    chmod +x "$ELECTRON_BIN"
    echo "[*] Electron downloaded."
fi

# --- VERSION CHECK ---
if command -v curl >/dev/null 2>&1; then
    REMOTE_VERSION=$(curl -sf --max-time 5 "$VERSION_URL" || echo "")
    LOCAL_VERSION=$(cat "$INSTALL_DIR/version.txt" 2>/dev/null || echo "none")

    if [ -n "$REMOTE_VERSION" ] && [ "$REMOTE_VERSION" != "$LOCAL_VERSION" ]; then
        if command -v zenity >/dev/null 2>&1; then
            zenity --question \
                --title="Zalo Update Available" \
                --text="A new version of Zalo is available.\n\nInstalled: <b>$LOCAL_VERSION</b>\nLatest:       <b>$REMOTE_VERSION</b>\n\nUpdate now?" \
                --ok-label="Update" \
                --cancel-label="Skip" \
                --width=320 2>/dev/null && bash "$INSTALL_DIR/update.sh"
        fi
    fi
fi

# --- RUN APP ---
echo "[*] Launching with Electron $ELECTRON_VERSION..."
ELECTRON_ENABLE_LOGGING=1 "$ELECTRON_BIN" "$INSTALL_DIR"
