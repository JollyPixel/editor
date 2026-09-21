---
"@jolly-pixel/editor.pixel-art": patch
---

Rebuild the colour picker wiring on `FieldBinding`: `pickerChange` now exposes
a value-based `pickerSource` instead of taking a DOM event, and `assertElement`
is gone in favour of inlined throws.
