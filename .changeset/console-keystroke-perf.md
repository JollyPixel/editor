---
"@jolly-pixel/console": patch
---

Faster, lower-allocation search and rendering per keystroke: cached per-entry search text, letter-set rejection, top-50 selection, and a log that no longer re-renders while typing.
`scrollback` now returns the same frozen array until it changes.
