#!/bin/bash
set -e

# --- ALWAYS RUN FROM SCRIPT'S OWN DIRECTORY ---
cd "$(dirname "$0")"

# --- READ CONFIG FROM EXISTING FILES ---
ELECTRON_VERSION=$(grep -m1 'ELECTRON_VERSION=' start.sh | cut -d'"' -f2)
APP_NAME=$(grep -m1 'APP_NAME=' install.sh | cut -d'"' -f2)
ICON_SRC=$(grep -m1 'ICON_SRC=' install.sh | cut -d'"' -f2 | sed 's|\./||')
EXCLUDE_LIST="$(grep -m1 'EXCLUDE_LIST=' install.sh | cut -d'"' -f2)"
VERSION=$(cat version.txt 2>/dev/null | tr -d '[:space:]')

APP_ID="${APP_NAME,,}"
ARCH="x86_64"
OUTPUT_DIR="$(pwd)/dist"
APPDIR="$OUTPUT_DIR/${APP_NAME}.AppDir"
APPIMAGETOOL="/tmp/appimagetool"
APPIMAGETOOL_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
ELECTRON_URL="https://github.com/electron/electron/releases/download/$ELECTRON_VERSION/electron-$ELECTRON_VERSION-linux-x64.zip"
ELECTRON_ZIP="/tmp/electron-$ELECTRON_VERSION.zip"

# --- HELPERS ---
print_step() { echo ""; echo ">>> $1"; }
command_exists() { command -v "$1" >/dev/null 2>&1; }
debug() { echo "    [DEBUG] $1"; }

echo "============================================"
echo "  Building $APP_NAME AppImage (DEBUG MODE)"
echo "  CWD            : $(pwd)"
echo "  Version        : $VERSION"
echo "  Electron       : $ELECTRON_VERSION"
echo "  Icon source    : $ICON_SRC"
echo "  Excluded items : $EXCLUDE_LIST"
echo "  OUTPUT_DIR     : $OUTPUT_DIR"
echo "  APPDIR         : $APPDIR"
echo "  ELECTRON_ZIP   : $ELECTRON_ZIP"
echo "============================================"

# --- CHECK DEPS ---
print_step "Checking dependencies..."
for dep in wget unzip; do
    if command_exists "$dep"; then
        debug "$dep: OK ($(command -v $dep))"
    else
        echo "ERROR: '$dep' is required but not installed."; exit 1
    fi
done

# --- DOWNLOAD APPIMAGETOOL ---
print_step "Fetching appimagetool..."
if [ ! -f "$APPIMAGETOOL" ]; then
    wget -q --show-progress -O "$APPIMAGETOOL" "$APPIMAGETOOL_URL"
    chmod +x "$APPIMAGETOOL"
else
    debug "Already cached at $APPIMAGETOOL"
fi
debug "appimagetool size: $(du -sh "$APPIMAGETOOL" | cut -f1)"

# --- DOWNLOAD ELECTRON ---
print_step "Fetching Electron $ELECTRON_VERSION..."
if [ -f "$ELECTRON_ZIP" ]; then
    debug "Cached zip found, validating..."
    if ! unzip -t "$ELECTRON_ZIP" > /dev/null 2>&1; then
        echo "  Cached zip is corrupt, re-downloading..."
        rm -f "$ELECTRON_ZIP"
    else
        debug "Zip is valid"
    fi
fi
if [ ! -f "$ELECTRON_ZIP" ]; then
    wget -q --show-progress -O "$ELECTRON_ZIP" "$ELECTRON_URL"
else
    debug "Already cached at $ELECTRON_ZIP"
fi
debug "Electron zip size: $(du -sh "$ELECTRON_ZIP" | cut -f1)"
debug "Zip integrity check:"
unzip -t "$ELECTRON_ZIP" | tail -3

# --- CLEAN & PREPARE APPDIR ---
print_step "Preparing AppDir..."
rm -rf "$APPDIR"
mkdir -p "$APPDIR"
debug "AppDir created: $APPDIR"

# --- COPY APP FILES ---
print_step "Copying app files (excluding: $EXCLUDE_LIST)..."
shopt -s dotglob
for item in *; do
    [[ "$item" == "." || "$item" == ".." ]] && continue
    skip=false
    for excluded in $EXCLUDE_LIST; do
        [ "$item" == "$excluded" ] && skip=true && break
    done
    if ! $skip; then
        echo "  COPYING: $item"
        cp -r "$item" "$APPDIR/"
    else
        echo "  SKIPPED: $item"
    fi
done
debug "AppDir contents after copy:"
ls "$APPDIR"

find "$APPDIR" -type f -name '*.sh' -exec chmod +x {} \;

# --- BUNDLE ELECTRON ---
print_step "Bundling Electron $ELECTRON_VERSION..."
mkdir -p "$APPDIR/electron"
debug "Extracting zip to: $APPDIR/electron"
unzip -q "$ELECTRON_ZIP" -d "$APPDIR/electron"
debug "Contents after unzip:"
ls "$APPDIR/electron"

SUBDIR="$APPDIR/electron/electron-$ELECTRON_VERSION-linux-x64"
if [ -d "$SUBDIR" ]; then
    debug "Subdirectory detected, flattening..."
    mv "$SUBDIR"/* "$APPDIR/electron/"
    rmdir "$SUBDIR"
fi

debug "Contents after flatten:"
ls "$APPDIR/electron"

if [ ! -f "$APPDIR/electron/electron" ]; then
    echo "ERROR: electron binary not found after extraction!"
    echo "Full contents of $APPDIR/electron:"
    ls -la "$APPDIR/electron"
    exit 1
fi

chmod +x "$APPDIR/electron/electron"
find "$APPDIR/electron" -type f ! -name "*.so*" -exec chmod +x {} \; 2>/dev/null || true
debug "electron binary: OK ($(du -sh "$APPDIR/electron/electron" | cut -f1))"
debug "Total electron dir: $(du -sh "$APPDIR/electron" | cut -f1)"

# --- ICON ---
print_step "Setting up icon..."
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$APPDIR/$APP_ID.png"
    debug "Icon copied: $ICON_SRC → $APPDIR/$APP_ID.png"
else
    echo "  WARNING: Icon not found at $ICON_SRC"
fi

# --- AppRun ---
print_step "Creating AppRun..."
printf '#!/bin/bash\nSELF_DIR="$(dirname "$(readlink -f "$0")")"\nexec bash "$SELF_DIR/start.sh" "$@"\n' > "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"
debug "AppRun created:"
cat "$APPDIR/AppRun"

# --- .desktop FILE ---
print_step "Creating .desktop entry..."
printf '[Desktop Entry]\nName=%s\nComment=Zalo Messenger\nExec=AppRun\nIcon=%s\nTerminal=false\nType=Application\nCategories=Network;InstantMessaging;\nStartupWMClass=%s\n' \
    "$APP_NAME" "$APP_ID" "$APP_NAME" > "$APPDIR/$APP_ID.desktop"
debug ".desktop created:"
cat "$APPDIR/$APP_ID.desktop"

# --- FINAL APPDIR OVERVIEW ---
print_step "Final AppDir overview..."
echo "  Top-level:"
ls "$APPDIR"
echo ""
echo "  electron/ (first 20):"
ls "$APPDIR/electron" | head -20
echo ""
echo "  Total AppDir size: $(du -sh "$APPDIR" | cut -f1)"

# --- BUILD ---
print_step "Building AppImage..."
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/${APP_NAME}-${VERSION}-${ARCH}.AppImage"
debug "Output file: $OUTPUT_FILE"

ARCH=$ARCH "$APPIMAGETOOL" "$APPDIR" "$OUTPUT_FILE" 2>&1
chmod +x "$OUTPUT_FILE"

echo ""
echo "============================================"
echo "  Done!"
echo "  Output : $OUTPUT_FILE"
echo "  Size   : $(du -sh "$OUTPUT_FILE" | cut -f1)"
echo "  Run    : $OUTPUT_FILE"
echo "============================================"
echo ""
