#!/bin/bash
set -euo pipefail

APP_NAME="Zalo"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
INSTALL_PARENT="$HOME/.local/share"
INSTALL_DIR="$INSTALL_PARENT/zalo"
DESKTOP_DIR="$HOME/.local/share/applications"
RECOVERY_DIR="$HOME/zalo-native-recovery"
CONFIG_FILE="$SCRIPT_DIR/launch.json"
STAGING_ROOT=""

print_step() { printf '\n>>> %s\n' "$1"; }
command_exists() { command -v "$1" >/dev/null 2>&1; }
cleanup() {
    if [[ -n "$STAGING_ROOT" && -d "$STAGING_ROOT" ]]; then
        rm -rf -- "$STAGING_ROOT"
    fi
}
trap cleanup EXIT

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
    echo "ERROR: Zalo currently supports Linux x86_64 only." >&2
    exit 1
fi
if ! command_exists node; then
    echo "ERROR: Node.js 18, 20 or 22 is required." >&2
    exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 18 || NODE_MAJOR > 22 )); then
    echo "ERROR: Node.js 18, 20 or 22 is required (found $(node --version))." >&2
    exit 1
fi
for tool in curl unzip; do
    if ! command_exists "$tool"; then
        echo "ERROR: '$tool' is required. Install it with your distribution package manager." >&2
        exit 1
    fi
done

cd -- "$SCRIPT_DIR"
if [[ ! -f "$CONFIG_FILE" ]]; then
    print_step "Detecting Electron and media devices..."
    node scripts/auto-config.mjs
fi

# Building in a sibling staging directory keeps the active installation intact
# until the complete payload and generated manifest have been written.
mkdir -p -- "$INSTALL_PARENT" "$DESKTOP_DIR" "$RECOVERY_DIR"
STAGING_ROOT="$(mktemp -d "$INSTALL_PARENT/.zalo-install.XXXXXX")"
STAGED_APP="$STAGING_ROOT/zalo"
print_step "Building verified Zalo installation..."
node scripts/install-native.mjs "$CONFIG_FILE" "$STAGED_APP" --app-dir "$INSTALL_DIR"
node "$STAGED_APP/scripts/verify-installation.mjs" "$STAGED_APP" --require-generated

# Do not replace files underneath a live Electron process. Launching install.sh
# again after quitting Zalo is safe; the staged directory is cleaned on exit.
for cmdline in /proc/[0-9]*/cmdline; do
    [[ -r "$cmdline" ]] || continue
    if [[ "$(tr '\0' ' ' < "$cmdline" 2>/dev/null)" == *"$INSTALL_DIR"* ]]; then
        echo "ERROR: Zalo is running. Quit it from the tray, then run install.sh again." >&2
        exit 1
    fi
done

BACKUP_DIR=""
if [[ -d "$INSTALL_DIR" ]]; then
    BACKUP_ROOT="$(mktemp -d "$RECOVERY_DIR/zalo-before-$(date +%Y%m%d-%H%M%S)-XXXXXX")"
    BACKUP_DIR="$BACKUP_ROOT/zalo"
    print_step "Moving the previous installation to $BACKUP_DIR..."
    mv -- "$INSTALL_DIR" "$BACKUP_DIR"
fi
if ! mv -- "$STAGED_APP" "$INSTALL_DIR"; then
    [[ -n "$BACKUP_DIR" && ! -e "$INSTALL_DIR" ]] && mv -- "$BACKUP_DIR" "$INSTALL_DIR"
    echo "ERROR: Could not activate the new installation; the previous copy was restored." >&2
    exit 1
fi

print_step "Registering one Zalo launcher with the official icon..."
# Remove launcher names used by earlier native releases. The Windows/Wine entry
# is intentionally left alone because it may belong to a separate installation.
rm -f -- "$DESKTOP_DIR/Zalo.desktop" \
    "$DESKTOP_DIR/zalo-linux-native.desktop" \
    "$DESKTOP_DIR/zalo-native.desktop" \
    "$DESKTOP_DIR/zalo.desktop"
if [[ -d "$HOME/Desktop" ]]; then
    rm -f -- "$HOME/Desktop/Zalo.desktop" "$HOME/Desktop/zalo-linux-native.desktop"
fi

# KDE stores recently launched desktop IDs separately from the .desktop files.
# Clear only IDs used by older native releases so removed launchers do not stay
# behind as blank "Zalo Linux Native" results in the application menu.
if command_exists qdbus6; then
    while IFS= read -r activity_id; do
        [[ -n "$activity_id" ]] || continue
        for client in org.kde.plasma.kicker org.kde.krunner; do
            for resource in applications:zalo-linux-native.desktop applications:zalo-native.desktop applications:Zalo.desktop; do
                qdbus6 org.kde.ActivityManager /ActivityManager/Resources/Scoring \
                    org.kde.ActivityManager.ResourcesScoring.DeleteStatsForResource \
                    "$activity_id" "$client" "$resource" >/dev/null 2>&1 || true
            done
        done
    done < <(qdbus6 org.kde.ActivityManager /ActivityManager/Activities \
        org.kde.ActivityManager.Activities.ListActivities 2>/dev/null || true)
fi
node "$INSTALL_DIR/scripts/register-desktop.mjs" "$INSTALL_DIR"

command_exists update-desktop-database && update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
command_exists kbuildsycoca6 && kbuildsycoca6 --noincremental >/dev/null 2>&1 || true
command_exists kbuildsycoca5 && kbuildsycoca5 --noincremental >/dev/null 2>&1 || true

printf '\n%s installed successfully.\nLocation: %s\nLauncher: %s/zalo.desktop\n' \
    "$APP_NAME" "$INSTALL_DIR" "$DESKTOP_DIR"
if [[ -n "$BACKUP_DIR" ]]; then
    printf 'Previous version backup: %s\n' "$BACKUP_DIR"
fi
