#!/bin/bash

# --- CONFIG ---
REPO_URL="https://github.com/realdtn2/zalo-linux-2026"
INSTALL_DIR="$HOME/.local/share/zalo"
TMP_DIR="/tmp/zalo-update-$$"
FIFO="/tmp/zalo-update-$$.fifo"
VERSION_URL="https://raw.githubusercontent.com/realdtn2/zalo-linux-2026/latest/version.txt"

# --- CLEANUP TRAP ---
cleanup() {
    rm -rf "$TMP_DIR" "$FIFO"
}
trap cleanup EXIT INT TERM

# --- HELPERS ---
command_exists() { command -v "$1" >/dev/null 2>&1; }
print_step() { echo ""; echo ">>> $1"; }

# --- SEMVER COMPARE ---
# Returns 0 if $1 < $2
version_lt() {
    local a="${1#v}" b="${2#v}"
    IFS='.' read -r a1 a2 a3 <<< "$a"
    IFS='.' read -r b1 b2 b3 <<< "$b"
    a1=${a1:-0}; a2=${a2:-0}; a3=${a3:-0}
    b1=${b1:-0}; b2=${b2:-0}; b3=${b3:-0}
    if   [ "$a1" -lt "$b1" ]; then return 0
    elif [ "$a1" -gt "$b1" ]; then return 1
    elif [ "$a2" -lt "$b2" ]; then return 0
    elif [ "$a2" -gt "$b2" ]; then return 1
    elif [ "$a3" -lt "$b3" ]; then return 0
    else return 1
    fi
}

# --- DEPENDENCY INSTALL ---
install_dependencies() {
    print_step "Installing missing dependencies: git curl zenity..."
    if command_exists apt-get; then
        sudo apt-get update -y && sudo apt-get install -y git curl zenity
    elif command_exists dnf; then
        sudo dnf install -y git curl zenity
    elif command_exists yum; then
        sudo yum install -y git curl zenity
    elif command_exists pacman; then
        sudo pacman -Sy --noconfirm git curl zenity
    elif command_exists zypper; then
        sudo zypper install -y git curl zenity
    elif command_exists apk; then
        sudo apk add git curl zenity
    elif command_exists xbps-install; then
        sudo xbps-install -Sy git curl zenity
    elif command_exists emerge; then
        sudo emerge --ask=n dev-vcs/git net-misc/curl gnome-extra/zenity
    else
        echo "ERROR: No supported package manager found."
        echo "Please manually install 'git', 'curl', and 'zenity', then re-run this script."
        exit 1
    fi
}

# --- CHECK DEPS ---
MISSING=0
command_exists git    || MISSING=1
command_exists curl   || MISSING=1
command_exists zenity || MISSING=1
[ "$MISSING" -eq 1 ] && install_dependencies

# --- VERSION CHECK ---
print_step "Checking for updates..."
REMOTE_VERSION=$(curl -sf --max-time 5 "$VERSION_URL" || echo "unknown")
LOCAL_VERSION=$(cat "$INSTALL_DIR/version.txt" 2>/dev/null || echo "v0.0.0")

echo "  Installed : $LOCAL_VERSION"
echo "  Latest    : $REMOTE_VERSION"

if [ "$REMOTE_VERSION" = "unknown" ]; then
    zenity --warning --title="Zalo Update" \
        --text="Could not reach GitHub.\nCheck your internet connection." 2>/dev/null
    exit 1
elif ! version_lt "$LOCAL_VERSION" "$REMOTE_VERSION"; then
    [ "$STARTUP_CHECK" = "1" ] && exit 0
    zenity --info --title="Zalo Update" \
        --text="Zalo is already up to date.\n\nInstalled: $LOCAL_VERSION" 2>/dev/null
    exit 0
fi

# --- CONFIRM ---
zenity --question --title="Zalo Update" \
    --text="A new version is available.\n\nInstalled: $LOCAL_VERSION\nLatest:    $REMOTE_VERSION\n\nUpdate now?" \
    2>/dev/null || exit 0

# --- SETUP FIFO ---
mkfifo "$FIFO"

# --- RUN UPDATE IN BACKGROUND, WRITE TO FIFO ---
(
    print_step "Fetching latest version from $REPO_URL..."
    if ! git clone --depth=1 "$REPO_URL" "$TMP_DIR"; then
        echo "ERROR: git clone failed."
        exit 1
    fi

    # Read EXCLUDE_LIST from the freshly cloned install.sh
    EXCLUDE_LIST="$(grep -m1 '^EXCLUDE_LIST=' "$TMP_DIR/install.sh" | cut -d'"' -f2)"

    print_step "Updating app files in $INSTALL_DIR..."
    cd "$TMP_DIR" || exit 1

    # dotglob is intentionally NOT set — avoids copying .git and other dotfiles
    for item in *; do
        [ "$item" = "." ] || [ "$item" = ".." ] && continue

        skip=false
        for excluded in $EXCLUDE_LIST; do
            if [ "$item" = "$excluded" ]; then
                echo "  SKIPPED: $item"
                skip=true
                break
            fi
        done

        if ! $skip; then
            echo "  UPDATING: $item"
            rm -rf "$INSTALL_DIR/$item"
            cp -r "$item" "$INSTALL_DIR/"
        fi
    done

    # Make every shell script executable
    find "$INSTALL_DIR" -type f -name '*.sh' -exec chmod +x {} \;

    echo ""
    echo "============================================"
    echo "  Zalo updated: $LOCAL_VERSION → $REMOTE_VERSION"
    echo "  Close to apply changes."
    echo "============================================"
    echo ""
) > "$FIFO" 2>&1 &
UPDATE_PID=$!

# --- OPEN ZENITY, READING FROM FIFO ---
# If zenity fails to launch, kill the background process to avoid an indefinite hang
if ! zenity --text-info \
    --title="Zalo Update" \
    --width=560 --height=400 \
    --ok-label="Close" \
    2>/dev/null < "$FIFO"; then
    kill "$UPDATE_PID" 2>/dev/null
fi

wait "$UPDATE_PID" 2>/dev/null
UPDATE_EXIT=$?

if [ "$UPDATE_EXIT" -ne 0 ]; then
    zenity --error --title="Zalo Update" \
        --text="Update failed. See the log above for details." 2>/dev/null
fi

exit "$UPDATE_EXIT"
