---
"@jolly-pixel/color": patch
---

Faster hex and named-color parsing and hex/rgb formatting through lookup tables and packed-integer hex decoding.
`parseColor` no longer resolves `Object.prototype` keys such as `constructor` to black.
