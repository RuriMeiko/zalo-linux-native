#!/bin/bash
set -euo pipefail
# Independent native development entry point: no downloads or auto-updates.
ZALO_PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
    echo 'Node.js is required. See NATIVE-LAUNCH.md for runtime setup.' >&2
    exit 1
fi
if [ $# -eq 0 ] && [ ! -f "$ZALO_PROJECT_DIR/launch.json" ]; then
    echo "No launch.json found. Auto-configuring for this machine..."
    node "$ZALO_PROJECT_DIR/scripts/auto-config.mjs"
fi
exec node "$ZALO_PROJECT_DIR/scripts/native-launch.mjs" "$@"
