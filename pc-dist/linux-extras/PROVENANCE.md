# Viewer extension provenance — publication review pending

`viewer.js` and `viewer.css` were extracted, without executing the Windows
program, from the user-supplied `Zalo-Print-Patcher.exe.zip`.
The embedded project identifies itself as **zalo-print-feature** / **Zalo Print
& Annotate Feature**. Its original author's name and redistribution license
have not yet been established. These files are not claimed as newly authored
by this Linux port's maintainer.

Input executable SHA-256:
`e98728e5f0c9819c4233db61880ae4be845ec8de99b2443b0746713160c670bb`

Extraction identified literal JavaScript and UTF-16LE CSS strings in the
packaged executable. No V8 bytecode, Windows patch routine or EXE is run by the
Linux app. No asset is downloaded at application startup.

`fabric-5.3.0.js` is the bundled Fabric.js dependency, reporting version 5.3.0.
It retains its embedded contents. Obtain and review the matching upstream
license/notice before publishing it; version text alone is not verification of
the complete upstream distribution.

Linux adaptations in `viewer.js`: print content survives until `afterprint`,
bounded image-load timeout, print setting validation, passcode-lock guards and
overlay cleanup, idempotent modal closure, owned blob URL cleanup, keyboard
toolbar buttons and scoped Ctrl+P handling. `loader.js` is new integration code
that loads these assets only when the image toolbar appears.

Further Linux fixes include self-contained SVG icons, explicit toolbar padding
to avoid inherited-style icon collapse, page-width-based print-preview margins,
and history entries for selection recoloring, font-size and object/text edits.
An isolated real-Chromium fixture verifies rectangle and recolor undo/redo,
annotated preview and lock cleanup; it does not prove OS printing or clipboard.

Local integration does not establish redistribution rights. These assets remain
an explicit release-review gate; do not silently apply the repository's package
metadata license to them or erase the supplied extension's provenance.
