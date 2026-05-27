#!/bin/bash
set -e

# --- CONFIG ---
APP_NAME="Zalo"
REPO_URL="https://github.com/realdtn2/zalo-linux-port-2026"
INSTALL_DIR="$HOME/.local/share/zalo"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_SRC="./pc-dist/favicon-96x96.v1.png"
ICON_DEST="$HOME/.local/share/icons/zalo.png"

# --- HELPERS ---
command_exists() { command -v "$1" >/dev/null 2>&1; }
print_step() { echo ""; echo ">>> $1"; }

# --- DEPENDENCY INSTALL ---
install_dependencies() {
    print_step "Installing missing dependencies: wget unzip curl git zenity..."
    if command_exists apt-get; then
        sudo apt-get update -y && sudo apt-get install -y wget unzip curl git zenity
    elif command_exists dnf; then
        sudo dnf install -y wget unzip curl git zenity
    elif command_exists yum; then
        sudo yum install -y wget unzip curl git zenity
    elif command_exists pacman; then
        sudo pacman -Sy --noconfirm wget unzip curl git zenity
    elif command_exists zypper; then
        sudo zypper install -y wget unzip curl git zenity
    elif command_exists apk; then
        sudo apk add wget unzip curl git zenity
    elif command_exists xbps-install; then
        sudo xbps-install -Sy wget unzip curl git zenity
    elif command_exists emerge; then
        sudo emerge --ask=n net-misc/wget app-arch/unzip net-misc/curl dev-vcs/git gnome-extra/zenity
    else
        echo "ERROR: No supported package manager found."
        echo "Please manually install 'wget', 'unzip', 'curl', 'git', and 'zenity', then re-run this script."
        exit 1
    fi
}

# --- CHECK DEPS ---
MISSING=0
command_exists wget   || MISSING=1
command_exists unzip  || MISSING=1
command_exists curl   || MISSING=1
command_exists git    || MISSING=1
command_exists zenity || MISSING=1
[ "$MISSING" -eq 1 ] && install_dependencies

# --- CLEAN PREVIOUS INSTALL ---
print_step "Removing previous installation if exists..."
rm -rf "$INSTALL_DIR"
rm -f  "$DESKTOP_DIR/$APP_NAME.desktop"
rm -f  "$DESKTOP_DIR/${APP_NAME}Update.desktop"
[ -d "$HOME/Desktop" ] && rm -f "$HOME/Desktop/$APP_NAME.desktop"
[ -d "$HOME/Desktop" ] && rm -f "$HOME/Desktop/${APP_NAME}Update.desktop"

# --- COPY APP FILES ---
print_step "Copying app files to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
for item in bootstrap.js package.json start.sh update.sh version.txt libs main-dist native pc-dist; do
    [ -e "./$item" ] && cp -r "./$item" "$INSTALL_DIR/"
done
chmod +x "$INSTALL_DIR/start.sh"
[ -f "$INSTALL_DIR/update.sh" ] && chmod +x "$INSTALL_DIR/update.sh"

# --- INSTALL ICON ---
print_step "Installing icon..."
mkdir -p "$HOME/.local/share/icons"
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$ICON_DEST"
else
    echo "WARNING: Icon not found at $ICON_SRC — desktop entries will have no icon."
    ICON_DEST=""
fi

# --- GENERATE DESKTOP FILES ---
print_step "Generating desktop entries..."
mkdir -p "$DESKTOP_DIR"

cat > "$DESKTOP_DIR/$APP_NAME.desktop" <<DESK
[Desktop Entry]
Name=$APP_NAME
Comment=Zalo Messenger
Exec=bash $INSTALL_DIR/start.sh
Icon=$ICON_DEST
Terminal=false
Type=Application
Categories=Network;InstantMessaging;
StartupWMClass=Zalo
DESK

cat > "$DESKTOP_DIR/${APP_NAME}Update.desktop" <<DESK
[Desktop Entry]
Name=Update $APP_NAME
Comment=Update Zalo to the latest version
Exec=bash -c 'bash $INSTALL_DIR/update.sh; read -p "Press Enter to close..."'
Icon=$ICON_DEST
Terminal=true
Type=Application
Categories=Network;InstantMessaging;
DESK

chmod +x "$DESKTOP_DIR/$APP_NAME.desktop"
chmod +x "$DESKTOP_DIR/${APP_NAME}Update.desktop"

if [ -d "$HOME/Desktop" ]; then
    cp "$DESKTOP_DIR/$APP_NAME.desktop"         "$HOME/Desktop/$APP_NAME.desktop"
    cp "$DESKTOP_DIR/${APP_NAME}Update.desktop" "$HOME/Desktop/${APP_NAME}Update.desktop"
    chmod +x "$HOME/Desktop/$APP_NAME.desktop"
    chmod +x "$HOME/Desktop/${APP_NAME}Update.desktop"
    if command_exists gio; then
        gio set "$HOME/Desktop/$APP_NAME.desktop"         metadata::trusted true 2>/dev/null || true
        gio set "$HOME/Desktop/${APP_NAME}Update.desktop" metadata::trusted true 2>/dev/null || true
    fi
fi

command_exists gio && gio set "$DESKTOP_DIR/$APP_NAME.desktop"         metadata::trusted true 2>/dev/null || true
command_exists gio && gio set "$DESKTOP_DIR/${APP_NAME}Update.desktop" metadata::trusted true 2>/dev/null || true
command_exists update-desktop-database && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

# --- DONE ---
echo ""
echo "============================================"
echo "  $APP_NAME installed successfully!"
echo "  Location : $INSTALL_DIR"
echo "  Launch   : $DESKTOP_DIR/$APP_NAME.desktop"
echo "  Update   : $DESKTOP_DIR/${APP_NAME}Update.desktop"
echo "============================================"
echo ""
