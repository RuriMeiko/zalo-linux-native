#!/bin/bash
set -e

# --- CONFIG ---
ELECTRON_VERSION="v22.3.27"
ELECTRON_DIR="$HOME/.local/electron-$ELECTRON_VERSION"
ELECTRON_BIN="$ELECTRON_DIR/electron"
DOWNLOAD_URL="https://github.com/electron/electron/releases/download/$ELECTRON_VERSION/electron-$ELECTRON_VERSION-linux-x64.zip"
VERSION_URL="https://raw.githubusercontent.com/realdtn2/zalo-linux-2026/latest/version.txt"
INSTALL_DIR="$(dirname "$0")"

# Use bundled electron if available (AppImage), otherwise use/download from ~/.local
if [ -f "$INSTALL_DIR/electron/electron" ]; then
    ELECTRON_BIN="$INSTALL_DIR/electron/electron"
fi

# --- SEMVER COMPARE ---
# Returns 0 if $1 < $2
version_lt() {
    local a="${1#v}" b="${2#v}"
    IFS='.' read -r a1 a2 a3 <<< "$a"
    IFS='.' read -r b1 b2 b3 <<< "$b"
    a1=${a1:-0}; a2=${a2:-0}; a3=${a3:-0}
    b1=${b1:-0}; b2=${b2:-0}; b3=${b3:-0}
    if [ "$a1" -lt "$b1" ]; then return 0
    elif [ "$a1" -gt "$b1" ]; then return 1
    elif [ "$a2" -lt "$b2" ]; then return 0
    elif [ "$a2" -gt "$b2" ]; then return 1
    elif [ "$a3" -lt "$b3" ]; then return 0
    else return 1
    fi
}

# --- DOWNLOAD ELECTRON IF NOT EXISTS (non-AppImage only) ---
if [ ! -f "$ELECTRON_BIN" ]; then
    echo "[*] Electron $ELECTRON_VERSION not found. Downloading..."

    TMP_ZIP="/tmp/electron-$ELECTRON_VERSION.zip"

    # Clean up TMP_ZIP on exit/interrupt
    trap 'rm -f "$TMP_ZIP"' EXIT INT TERM

    if ! wget -O "$TMP_ZIP" "$DOWNLOAD_URL"; then
        echo "ERROR: Failed to download Electron."
        exit 1
    fi

    mkdir -p "$ELECTRON_DIR"

    if ! unzip -q "$TMP_ZIP" -d "$ELECTRON_DIR"; then
        echo "ERROR: Failed to extract Electron (zip may be corrupt). Removing and retrying next launch."
        rm -f "$TMP_ZIP"
        exit 1
    fi

    if [ -d "$ELECTRON_DIR/electron-$ELECTRON_VERSION-linux-x64" ]; then
        mv "$ELECTRON_DIR"/electron-$ELECTRON_VERSION-linux-x64/* "$ELECTRON_DIR"
        rmdir "$ELECTRON_DIR/electron-$ELECTRON_VERSION-linux-x64"
    fi

    rm -f "$TMP_ZIP"
    trap - EXIT INT TERM

    chmod +x "$ELECTRON_BIN"
    echo "[*] Electron downloaded."
fi


# --- VERSION CHECK ---
if [ -n "$APPIMAGE" ]; then
    if command -v curl >/dev/null 2>&1 && command -v zenity >/dev/null 2>&1; then
        REMOTE_VERSION=$(curl -sf --max-time 5 "$VERSION_URL" || echo "")
        LOCAL_VERSION=$(cat "$INSTALL_DIR/version.txt" 2>/dev/null || echo "v0.0.0")
        if [ -n "$REMOTE_VERSION" ] && version_lt "$LOCAL_VERSION" "$REMOTE_VERSION"; then
            zenity --question \
                --title="Zalo Update Available" \
                --text="A new version of Zalo is available.\n\nInstalled: <b>$LOCAL_VERSION</b>\nLatest:    <b>$REMOTE_VERSION</b>\n\nOpen download page?" \
                --ok-label="Download" \
                --cancel-label="Skip" \
                --width=320 2>/dev/null \
            && xdg-open "https://github.com/realdtn2/zalo-linux-2026/releases/tag/$REMOTE_VERSION" || true
        fi
    fi
else
    bash "$INSTALL_DIR/update.sh"
fi

# --- RUN APP ---
echo "[*] Launching with Electron $ELECTRON_VERSION..."
EXTRA_FLAGS=""
if [ -f /etc/debian_version ]; then
    EXTRA_FLAGS="--no-sandbox"
fi
ELECTRON_ENABLE_LOGGING=1 "$ELECTRON_BIN" $EXTRA_FLAGS "$INSTALL_DIR"
