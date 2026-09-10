#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
app_dir=/home/rurimeiko/.local/share/zalo
electron_bin=/home/rurimeiko/.local/electron-v22.3.27/electron
schema_dir=/home/rurimeiko/.local/state/zalo-native-test
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
