#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if (($# < 2 || $# > 3)); then
    printf '%s\n' 'Usage: scripts/test-native-call-schema.sh APP_DIR ELECTRON_BIN [SCHEMA_DIR]' >&2
    exit 1
fi
app_dir=$1
electron_bin=$2
schema_dir=${3:-${XDG_STATE_HOME:-${HOME:?}/.local/state}/zalo-native-test}
if [[ "$app_dir" != /* || "$electron_bin" != /* || "$schema_dir" != /* ||
      "$app_dir$electron_bin$schema_dir" == *$'\n'* || "$app_dir$electron_bin$schema_dir" == *$'\r'* ]]; then
    printf '%s\n' 'App, Electron and schema paths must be absolute and single-line.' >&2
    exit 1
fi
if [[ ! -d "$app_dir" || ! -x "$electron_bin" ]]; then
    printf '%s\n' 'App directory or Electron executable is unavailable.' >&2
    exit 1
fi
mkdir -p "$schema_dir"
chmod 700 "$schema_dir"
unset ZALO_ZCALL_CAPTURE
export ZALO_ZCALL_LOG=0
export ZCALL_USE_PROXY=0 ZCALL_PROXY_AUTOSTART=0
export ZALO_ZCALL_AGENT_PATH="$repo_dir/native/qt-call-cap-linux/zcall-agent.js"
export ZALO_ZCALL_SCHEMA_LOG="$schema_dir/signaling-schema.jsonl"
printf '%s\n' 'Diagnostic only: no native media. Close all existing Zalo windows/processes first.'
printf '%s\n' "Schema-only results: $ZALO_ZCALL_SCHEMA_LOG"
if pgrep -f "^${electron_bin} .*${app_dir}" >/dev/null; then
    printf '%s\n' 'Zalo is already running. Quit it from the tray, then run this test launcher again.' >&2
    exit 1
fi
debug_args=()
if [[ -n "${ZALO_ZCALL_CDP_PORT:-}" ]]; then
    if [[ ! "$ZALO_ZCALL_CDP_PORT" =~ ^[0-9]{4,5}$ ]] || ((10#$ZALO_ZCALL_CDP_PORT < 1024 || 10#$ZALO_ZCALL_CDP_PORT > 65535)); then
        printf '%s\n' 'Invalid CDP port (expected 1024..65535).' >&2
        exit 1
    fi
    debug_args=(--remote-debugging-address=127.0.0.1 "--remote-debugging-port=$ZALO_ZCALL_CDP_PORT")
fi
exec "$electron_bin" --no-sandbox "${debug_args[@]}" "$app_dir"
