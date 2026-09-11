#!/bin/bash
set -euo pipefail

cat >&2 <<'EOF'
The inherited downloader-based AppImage builder is disabled: it did not package
the native ZRTC runtime, did not verify inputs, and could publish unreviewed
proprietary assets. Build a private, manifest-verified AppDir instead:

  node scripts/build-native-appdir.mjs BUILD_CONFIG_JSON NEW_HOME_APPDIR --check
  node scripts/build-native-appdir.mjs BUILD_CONFIG_JSON NEW_HOME_APPDIR

See NATIVE-PACKAGING.md. Public AppImage creation remains blocked on component
licensing and clean-system acceptance.
EOF
exit 2
