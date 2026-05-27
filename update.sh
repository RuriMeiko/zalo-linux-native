#!/bin/bash
set -e

# --- CONFIG ---
REPO_URL="https://github.com/realdtn2/zalo-linux-port-2026"
INSTALL_DIR="$HOME/.local/share/zalo"
TMP_DIR="/tmp/zalo-update-$$"
VERSION_URL="https://raw.githubusercontent.com/realdtn2/zalo-linux-port-2026/master/version.txt"

# Files/dirs to update (excludes reverse-engineering, generate-addon.py, .git)
UPDATE_ITEMS="bootstrap.js package.json start.sh libs main-dist native pc-dist"

# --- HELPERS ---
command_exists() { command -v "$1" >/dev/null 2>&1; }
print_step() { echo ""; echo ">>> $1"; }

# --- DEPENDENCY INSTALL ---
install_dependencies() {
    print_step "Installing missing dependencies: git curl..."
    if command_exists apt-get; then
        sudo apt-get update -y && sudo apt-get install -y git curl
    elif command_exists dnf; then
        sudo dnf install -y git curl
    elif command_exists yum; then
        sudo yum install -y git curl
    elif command_exists pacman; then
        sudo pacman -Sy --noconfirm git curl
    elif command_exists zypper; then
        sudo zypper install -y git curl
    elif command_exists apk; then
        sudo apk add git curl
    elif command_exists xbps-install; then
        sudo xbps-install -Sy git curl
    elif command_exists emerge; then
        sudo emerge --ask=n dev-vcs/git net-misc/curl
    else
        echo "ERROR: No supported package manager found."
        echo "Please manually install 'git' and 'curl', then re-run this script."
        exit 1
    fi
}

# --- CHECK DEPS ---
MISSING=0
command_exists git  || MISSING=1
command_exists curl || MISSING=1
[ "$MISSING" -eq 1 ] && install_dependencies

# --- VERSION CHECK ---
print_step "Checking for updates..."
REMOTE_VERSION=$(curl -sf --max-time 5 "$VERSION_URL" || echo "unknown")
LOCAL_VERSION=$(cat "$INSTALL_DIR/version.txt" 2>/dev/null || echo "none")

echo "  Installed : $LOCAL_VERSION"
echo "  Latest    : $REMOTE_VERSION"

if [ "$REMOTE_VERSION" = "unknown" ]; then
    echo "WARNING: Could not fetch remote version. Proceeding anyway..."
elif [ "$REMOTE_VERSION" = "$LOCAL_VERSION" ]; then
    echo ""
    echo "Already up to date ($LOCAL_VERSION). Nothing to do."
    exit 0
fi

print_step "Fetching latest version from $REPO_URL..."
git clone --depth=1 "$REPO_URL" "$TMP_DIR"

print_step "Updating app files in $INSTALL_DIR..."
for item in $UPDATE_ITEMS; do
    if [ -e "$TMP_DIR/$item" ]; then
        rm -rf "$INSTALL_DIR/$item"
        cp -r "$TMP_DIR/$item" "$INSTALL_DIR/$item"
        echo "  updated: $item"
    fi
done

# Update update.sh itself
if [ -f "$TMP_DIR/update.sh" ]; then
    cp "$TMP_DIR/update.sh" "$INSTALL_DIR/update.sh"
    chmod +x "$INSTALL_DIR/update.sh"
    echo "  updated: update.sh"
fi

# Update version.txt
if [ -f "$TMP_DIR/version.txt" ]; then
    cp "$TMP_DIR/version.txt" "$INSTALL_DIR/version.txt"
fi

chmod +x "$INSTALL_DIR/start.sh"

# --- CLEANUP ---
rm -rf "$TMP_DIR"

echo ""
echo "============================================"
echo "  Zalo updated: $LOCAL_VERSION → $REMOTE_VERSION"
echo "  Restart Zalo to apply changes."
echo "============================================"
echo ""
