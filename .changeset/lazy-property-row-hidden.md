---
"@jolly-pixel/ui": patch
---

Fixed `PropertyRow`'s `hidden` attribute doing nothing - it was missing the `:host([hidden])` override every other hideable facade element already has, so setting `.hidden` left it visibly rendered.
