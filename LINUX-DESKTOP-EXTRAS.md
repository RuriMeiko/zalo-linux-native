# Linux desktop extras — work in progress

Requested: integrate the supplied Print Patcher's viewer features, replace the
double window title with one Ghostty-inspired header displaying the account
name, and expose Zalo's passcode lock from that header.

## Header and lock

The working tree now removes the Linux main-window system frame and uses the
existing Zalo titlebar, centering the account title and adding accessible
minimize/maximize/close buttons and a lock button. The dark gray palette and
round controls follow the user's Ghostty screenshot. Current control sizing
retains Zalo's existing content layout; visual sizing still needs review.

The lock button invokes the existing `_showAppLock`: with no passcode it opens
Zalo's setup dialog; with a passcode it closes related activities/viewers and
dispatches the existing app-lock action. It does not implement a new password
store or a cosmetic lock overlay. The existing verification, retry handling,
restart behavior and notification privacy still require live acceptance tests.
An application passcode is not a claim of encrypted local storage.

`node scripts/test-linux-header.cjs` executes the actual bundled titlebar class
with isolated boundary stubs. This covers dispatch and rendering structure,
not actual compositor controls or passcode verification.

These changes have been copied into the installed application files at
`/home/rurimeiko/.local/share/zalo` on 2026-09-09, with all three changed bundles
and five added assets verified against the development checkout. The existing
running processes have **not been restarted**, so this does not establish that
the new header is active. Both compact and shared/login header classes pass
the isolated tests (`node scripts/test-linux-header.cjs` and `--shared`).

Subsequent source-only changes added a passcode-state bridge for the experimental
video display. Current main and compact bundle hashes no longer match the
installed copies; the original header/viewer deployment above must not be read
as deployment of those newer changes. The viewer asset directory still matches
the installed copy. Restart approval and live acceptance are still pending.

Before accepting deployment, test main/login/child windows, resize, maximize, keyboard focus,
account-name truncation, setup cancellation, wrong/correct passcode, restart,
notifications, and image viewers while locked. Never choose a user's passcode.

## Supplied Print Patcher

Inspected input: `/data/Downloads/Zalo-Print-Patcher.exe.zip`, containing one
58,924,916-byte Windows executable. Read-only inspection found packaged
JavaScript for `zalo-print-feature`, with viewer buttons for drawing/annotation
and print preview. Observed tools include pen, text, arrow, rectangle, undo,
redo, delete, clear and copy. Print preview includes paper size, orientation,
fit, margins and border settings. The Windows executable was not run.

The full embedded feature JavaScript and CSS are now extracted into
`pc-dist/linux-extras`, along with the supplied Fabric.js 5.3.0 dependency.
The main bundle loads a small local loader; Fabric and the feature only load
when the image toolbar exists. No EXE or Windows patching code runs on Linux.
Self-contained SVG icons replace the unverified external icon-font dependency.

The original 600 ms print-frame removal is replaced with `afterprint` cleanup;
there is a separate bounded image-load timeout. Additional adaptations validate
print settings, guard against opening while locked, close extension overlays on
lock, release owned blob URLs, make viewer buttons keyboard accessible, and
avoid capturing Ctrl+P outside an active image. Preview margins now use actual
page-width scaling rather than an orientation-dependent percentage mismatch.

`node scripts/test-viewer-extras.cjs` exercises the actual embedded print module
with isolated DOM boundaries: frame lifetime, failure cleanup, lock guard,
invalid settings and page dimensions pass. A separate Chromium fixture now
passes actual Fabric drawing, pixel-exact rectangle undo/redo, recolor undo/redo,
annotated preview at the original 640×400 resolution, and overlay cleanup/open
guards when locked. This caught and fixed missing history entries for recolor;
history hooks now also cover font-size changes and object/text edit completion.
The fixture excludes active-selection decoration when comparing image pixels.

Reproduce with a separate agent-browser session (never an account session):

```sh
agent-browser --session zalo-extras-test open file:///tmp/zalo-linux-2026/scripts/viewer-extras-fixture.html
agent-browser --session zalo-extras-test eval --stdin < scripts/test-viewer-extras-browser.js
agent-browser --session zalo-extras-test close
```

The file URL above reflects the current development checkout; adjust for another
checkout. This test uses only an internally generated PNG and does not write
the OS clipboard or submit printer jobs. **Real Zalo integration, clipboard,
native printer dialog, and full editing-tool acceptance remain unverified.** The installed
files are updated, but restart and live acceptance remain pending. Publication still requires the author and
license review recorded in `pc-dist/linux-extras/PROVENANCE.md`.

## Local deployment recovery

The exact changes to the three existing installed bundles are recorded in
`/home/rurimeiko/.local/state/zalo-native-test/desktop-extras-20260909.patch`.
Reverse applicability was checked successfully after installation. From the
installed app directory, after quitting Zalo, recovery is:

```sh
git apply --reverse --check /home/rurimeiko/.local/state/zalo-native-test/desktop-extras-20260909.patch
git apply --reverse /home/rurimeiko/.local/state/zalo-native-test/desktop-extras-20260909.patch
```

This restores only the modified existing bundles; it does not touch profiles,
messages, native voice setup or unrelated changes. The newly added
`pc-dist/linux-extras` directory is left in place but no longer loaded by the
restored bundle. If reverse checking fails after subsequent edits, stop and
inspect rather than force replacement. Recovery has not been executed.

## Remaining project scope

These additions do not replace the outstanding native video call, packaging,
independent repository, publication and provenance requirements in the main
port/release checklists.
