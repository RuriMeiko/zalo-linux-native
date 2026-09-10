# Portable native voice launcher (development)

This launches the experimentally verified native voice path without Wine or
an emulator. It is not yet a self-contained installer or a working video-call
release. It requires the patched desktop client, the Linux helper with
`ZALO_ZCALL_AGENT_PATH` support, and the pinned runtime described in
[native/android-zrtc/README.md](native/android-zrtc/README.md).

## Configure

Create `$XDG_CONFIG_HOME/zalo-native-linux/launch.json` (normally
`~/.config/zalo-native-linux/launch.json`) as a local file:

```json
{
  "appDir": "/absolute/path/to/patched/zalo",
  "electron": "/absolute/path/to/electron-v22.3.27/electron",
  "runtime": "/absolute/path/to/zrtc-native-21.12.01",
  "source": "exact-microphone-name-from-pactl",
  "sink": "exact-speaker-name-from-pactl"
}
```

Find device names with `pactl list sources short` and `pactl list sinks short`.
Bluetooth input names containing colons are supported. A `.monitor` source is
system playback, not a microphone, and is rejected by this launcher. Choose a
duplex headset profile if the microphone needs HFP; the launcher does not change
global defaults, Bluetooth profiles or volume automatically.

Paths must be absolute and are not shell-expanded: replace placeholders; do not
put `$HOME` or `~` inside JSON strings. Config files must not contain passwords,
account sessions or tokens. Keep your device-specific config out of Git.

## Check and launch

```sh
node scripts/native-launch.mjs --check
node scripts/native-launch.mjs
# Or supply a different config file:
node scripts/native-launch.mjs /absolute/path/launch.json --check
```

`--check` verifies runtime files, the pinned ZRTC hash, and exact audio devices.
It does not prove call connectivity, renderer patch compatibility or camera
support. Close an existing Zalo instance from the tray before launching; existing
instances are rejected to avoid silently retaining old environment settings.

The launcher requires Node.js, Electron and a separately prepared runtime; it
does not install packages or download binaries. Unlike the inherited `start.sh`,
it does not run the upstream updater. The inherited installer/desktop shortcut
has not yet been replaced or validated for independent distribution.

## Experimental video opt-in

The integrated development tree also accepts these two configuration fields:

```json
{
  "experimentalVideo": true,
  "videoDevice": "/dev/video2"
}
```

Add them to the complete configuration above, choosing the actual camera node
on your machine (the example is not a detected device). Both fields are
required together; inherited video environment settings are discarded. With
the opt-in, the launcher enables the agent's existing native video/network/media
path and forwards only the selected `/dev/videoN` node. Without it, video stays
disabled. `--check` checks that the selected node is a character device, without
opening it or capturing frames. It does not prove V4L2 format support, camera
permissions, camera identity, or remote video connectivity. This is a manual
development entry point, not completion of incoming video UI or a video release.

## Explicit diagnostics and sandbox exception

- `"cdpPort": 9222` enables loopback-only remote debugging. Omit in normal use.
- `"noSandbox": true` explicitly disables the Electron sandbox if required by
  the installed Electron environment. This reduces process isolation; it is
  not enabled by default or automatically retried on failure.

Inherited raw call-capture, schema-log, preload and Electron-as-Node settings are
removed. This does not imply that the original desktop client writes no logs.
No new audio recording or image files are created by the launcher itself.

Tests: `node scripts/test-native-launch.mjs` validates configuration and process
arguments; it does not launch the app or place a call.
