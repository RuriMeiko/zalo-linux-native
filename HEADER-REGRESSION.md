# Image header regression — 2026-09-10

The old image-specific React render branch returned a drag strip with no window
buttons. The shared header now supplies minimize/maximize/close SVG buttons and
retains the image viewer's `onClose` callback rather than closing the main app.

Browser regression testing found another problem after that fix: with the
shipped stylesheets and an auto-sized media-viewer title container, the header
collapsed to 2px while its 30px buttons overflowed vertically. Scoped 46px
height/min-height and non-shrinking layout now keep the image header and its
parent stable; a scoped foreground color keeps the title readable.

Verification uses the actual extracted header class with synthetic props and
the shipped CSS, not account data. Generate HTML with:

```sh
node scripts/test-linux-header.cjs --shared --html
```

Save the stdout HTML in a local home-only fixture using the normal file-editing
workflow, open it in an isolated browser session, then run
`scripts/test-header-layout-browser.js` with `agent-browser eval --stdin`.
The assertions check 46px height, three contained 30px SVG buttons and title
color. Node tests additionally exercise the real close callback and lock guards.

The before/after screenshots from this check are retained locally under
`/home/rurimeiko/zalo-native-recovery/app-fixture/header-before.png` and
`header-after.png`. The after screenshot and browser geometry check passed.
This is a browser layout fixture, not live Electron window-manager acceptance;
native drag/maximize behavior still needs verification after restarting Zalo.
