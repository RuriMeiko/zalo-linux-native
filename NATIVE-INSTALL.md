# User-local development installation

This copies the tracked application payload into a **new directory inside your
home**. It is not a self-contained distribution: Node.js, Electron and the
pinned native runtime must already exist. It does not download binaries,
resolve redistribution rights, migrate an account profile or launch Zalo.

Prepare the explicit device/runtime configuration described in
[NATIVE-LAUNCH.md](NATIVE-LAUNCH.md). The installer replaces `appDir` in its copied
configuration with the new destination; the input configuration is unchanged.
Omit `cdpPort` and `noSandbox` unless you deliberately need those exceptions.
Existing explicit values are preserved; the installer never enables them itself.

From a Git checkout, choose a destination that does not exist, with an existing
parent directory (replace the example paths with your own):

```sh
node scripts/install-native.mjs /absolute/path/launch.json /home/your-user/ZaloNative --check
node scripts/install-native.mjs /absolute/path/launch.json /home/your-user/ZaloNative
bash /home/your-user/ZaloNative/launch-installed.sh --check
# Only when ready to open the app; close any existing Zalo first:
bash /home/your-user/ZaloNative/launch-installed.sh
```

`--check` validates the same source file types, symlink constraints and payload
hashes used for copying, plus runtime/device preflight. It creates no destination.
The destination cannot be the checkout, a parent/child of it, your home itself,
or an existing directory. Symlinks in payload paths and the destination parent
are rejected. Directory trees under selected tracked app roots are included;
untracked files, `.git`, root launch config and unrelated recovery artifacts
are not copied. **This allowlist is not a secret scanner**: review tracked
content before distributing a copy, especially inherited proprietary files.

The installed entry point resolves its own directory, including paths with
spaces. `launch.json` is mode 0600; `launch-installed.sh` is mode 0755. A final
`INSTALL-COMPLETE.json` contains each copied file's SHA-256 and mode. Every copied
file is compared with its inspected hash before the completion marker is written.
No marker means the copy did not complete. Partial directories are kept for
inspection; there is no automatic deletion, overwrite or rollback of your files.
The runtime and Electron paths remain external and are not portable by merely
moving this directory to another machine.

No menu shortcut or updater is installed. The app retains its existing profile
behavior, so running another copy is not an isolated second account. Do not
launch it concurrently with your current app to test installation.

## Evidence and remaining gates

`node scripts/test-install-native.mjs` creates a small synthetic fixture under
`~/zalo-native-recovery/`, tests real copying/hash verification, private config,
executable launcher, read-only check, existing destination refusal, and traversal/
symlink refusal. Fixtures are retained for inspection. It does not launch Electron.

On 2026-09-10, real-checkout `--check` validated 13,367 tracked payload files
before the installer/docs themselves were committed. This is not clean-machine
startup, native dependency acquisition, licensing review or voice/video acceptance.
Those remain [release gates](RELEASE-CHECKLIST.md).

After commit `3d2c354`, a full 13,370-file copy was created at
`~/zalo-native-recovery/standalone-install-check/`. Copy/hash validation completed,
the installed launcher passed `--check`, and its resolved helper path pointed
inside the copied installation rather than the source checkout. No second Zalo
instance was launched. Electron/native runtime still refer to the existing
external installations; this does not prove a clean-machine package.
# Optional Linux application menu entry

After copying an installation, ensure `~/.local/share/applications` exists, then
register the installed directory (not the source checkout):

```sh
node scripts/register-desktop.mjs /home/YOU/zalo-installed --check
node scripts/register-desktop.mjs /home/YOU/zalo-installed
```

This creates only `~/.local/share/applications/zalo-linux-native.desktop` and
does not launch the app. It uses the installation's `launch-installed.sh`, so
Node must be available in the desktop session's PATH; Electron/runtime remain
external. The generic `internet-chat` icon follows the desktop icon theme.
An existing entry is never overwritten. To unregister, remove that specific
`.desktop` file; do not remove the app or account profile. Installation paths
containing percent, equals or control characters are rejected. Exec arguments
are quoted according to the [freedesktop specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/exec-variables.html),
not passed through a shell.

`node scripts/test-register-desktop.mjs` exercises a synthetic home under the
persistent recovery directory, including check-only, quoted space paths,
no overwrite and symlink rejection. The generated entry passed
`desktop-file-validate`. Actual menu appearance and launch in a clean desktop
session remain acceptance checks; no real menu entry has been registered yet.
