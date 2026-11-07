---
"@jolly-pixel/utils": patch
---

`decodeBase64` skips its validation regex when `Uint8Array.fromBase64` exists and lets the strict native decoder reject malformed text, which saves 40 to 80 ms on a 7 MB model snapshot in Chrome.
