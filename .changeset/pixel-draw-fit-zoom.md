---
"@jolly-pixel/pixel-draw.renderer": patch
---

`PixelArtCanvas`'s default zoom (when `zoom.default` is omitted) now fits the whole texture inside the container's initial size, instead of a flat `4` — a large texture in a small container no longer starts zoomed in past what's visible. Pass an explicit `zoom.default` to opt out.
