# Credits and provenance

This Linux-native continuation is developed from the existing
[realdtn2/zalo-linux-2026](https://github.com/realdtn2/zalo-linux-2026) project.
Making an independent repository does not erase that origin or transfer the
ownership of earlier work to the new maintainer.

## Earlier work

- **realdtn2 / realdtn**: upstream repository, initial macOS-client extraction
  and Linux/Electron port, synchronization fixes, launch/install/update and
  AppImage work, and reverse-engineering notes. The local Git history contains
  both author spellings; they are retained rather than rewritten.
- **RuriMeiko / rurimeiko**: subsequent Linux native-module replacements,
  call-v2 bridge, investigation and tests present in this development history.
  These are author names recorded by Git, not a claim of sole authorship of
  the entire application.
- **VNG / Zalo and their contributors**: original desktop client, proprietary
  application assets, protocols and native media engine. This is an unofficial
  compatibility project, not an official VNG product or an independently
  reimplemented open-source Zalo client.
- **Third-party projects**: Electron, Node.js, WebRTC, Android/Bionic, Opus,
  codec libraries, FFmpeg and the Linux multimedia stack retain their own
  copyright notices and license conditions.

The upstream base for this continuation is
`00dd2503aa54669508770537774b7ae00540a032`, fetched from
`RuriMeiko/zalo-linux-native`, branch `port/linux-native-modules`.
The full-app integration retains that commit and its ancestors; recovered work
is added on top, without rewriting earlier authors.
The initial local commit is `09999c3` (author `realdtn2`, subject `original`).
These identify the inspected source history; they do not establish that every
local commit exists in the upstream remote.

## New Linux-native work and limits

The continuation includes a separate Bionic worker loading the existing Android
x86_64 ZRTC engine, Linux PCM integration, desktop signaling coordination, and
an experimental CPU camera ingress adapter. Native outgoing voice was verified
by an actual UI-initiated call and the user's two-way-audio confirmation.
Camera ingress alone is not a working video call.

“Native Linux” here means the tested call runs without Wine or an Android
emulator. It does not mean every library is newly authored, that the Electron
interface is a new Linux toolkit UI, or that proprietary binaries are open source.

## License handling

The supplied **Zalo Print & Annotate Feature / zalo-print-feature** viewer
extension and its Fabric.js dependency retain separate provenance in
[the viewer asset manifest](pc-dist/linux-extras/PROVENANCE.md). The original
extension author's identity and redistribution permission still need to be
established; the Linux adaptations do not imply original authorship.

No top-level license file was found in the inspected repository. A `license`
field in application package metadata is not sufficient evidence of permission
to relicense or redistribute all extracted application assets and binaries.
Do not replace original author fields, remove notices, apply one blanket license
to the tree, or publish a binary release until component permissions and notices
have been reviewed. Attribution is required provenance, not a substitute for
redistribution permission.

For an independent repository, preserve available commit history and authors
for material being carried forward, or include a precise source manifest and
upstream revision for a source-only continuation. Keep this file visible in the
README and shipped documentation. Record the new repository URL only after it
actually exists.
