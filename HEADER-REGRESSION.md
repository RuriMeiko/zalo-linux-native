# Image header regression — 2026-09-10

The old image-specific React render branch returned a drag strip with no window
buttons. The shared header now supplies minimize/maximize/close SVG buttons and
retains the image viewer's `onClose` callback rather than closing the main app.

Browser regression testing found another problem after that fix: with the
shipped stylesheets and an auto-sized media-viewer title container, the header
collapsed to 2px while its buttons overflowed vertically. The first repair then
made the viewer 46px tall while the main header remained 24px. Live review found
the first shared 38px revision too large; both now use the closer-to-original
32px token, 13px semibold title, 24px buttons and 12px SVG symbols. The viewer
host is explicitly full-width, non-shrinking and clipped to keep its controls
inside the same row instead of overlapping the right sidebar.
The Linux header also overrides the inherited macOS left and width reservations
with exact edge-to-edge geometry; browser regression requires both header edges
to match the fixture window.

Verification uses the actual extracted header class with synthetic props and
the shipped CSS, not account data. Generate HTML with:

```sh
node scripts/test-linux-header.cjs --shared --html
```

Save the stdout HTML in a local home-only fixture using the normal file-editing
workflow, open it in an isolated browser session, then run
`scripts/test-header-layout-browser.js` with `agent-browser eval --stdin`.
The assertions check one shared 32px header token, contained 24px SVG buttons,
13px title/12px icon sizing and full-width viewer clipping. Node tests additionally
exercise the real close callback and lock guards.

The before/after screenshots from this check are retained locally (not tracked) under
`~/zalo-native-recovery/app-fixture/header-before.png` and
`header-after.png`. The after screenshot and browser geometry check passed.
This is a browser layout fixture, not live Electron window-manager acceptance;
native drag/maximize behavior still needs verification after restarting Zalo.
# Unified header follow-up — 2026-09-10

After live screenshots showed the main and viewer headers at opposite extremes,
both bundled header variants now use the shared dimensions above and 6px gaps.
Changes are CSS-only; existing close, restore, minimize and lock handlers are
preserved. Compact/shared class tests and the rendered viewer geometry fixture
must pass before deployment; refreshed screenshots stay under the local
`~/zalo-native-recovery/app-fixture/` directory and are not published.

The browser fixture is not a substitute for live Electron window-manager
acceptance. The installed app must be restarted from the matching manifest
snapshot before the user evaluates the two headers together.
