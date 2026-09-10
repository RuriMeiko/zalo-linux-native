#!/bin/bash
set -euo pipefail
# Read-only development check. No archive replacement of installed app files.
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != '--check' ) ]]; then
    echo 'Usage: bash update.sh [--check] (read-only)' >&2
    exit 2
fi
ZALO_PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ZALO_REMOTE='https://github.com/RuriMeiko/zalo-linux-native.git'
ZALO_REMOTE_HEAD="$(git ls-remote --exit-code "$ZALO_REMOTE" refs/heads/main)"
ZALO_REMOTE_HASH="${ZALO_REMOTE_HEAD%%[[:space:]]*}"
echo "Development main: $ZALO_REMOTE_HASH"
ZALO_GIT_ROOT="$(git -C "$ZALO_PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ "$ZALO_GIT_ROOT" == "$ZALO_PROJECT_DIR" ]]; then
    echo "Local checkout:   $(git -C "$ZALO_PROJECT_DIR" rev-parse HEAD)"
else
    echo 'Installed copy: no project Git checkout; version comparison unavailable.'
fi
echo 'No files changed. Review main in the project repository before updating.'
echo 'An automatic installer/updater is not yet verified for the native runtime.'
