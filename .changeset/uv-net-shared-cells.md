---
"@jolly-pixel/pixel-draw.renderer": major
---

`UVNet` cells can hold several slots that share one rectangle, `UVNet.rows` cells are now slot lists, and `missingSlots()` tells whether a net fits a region; unfolded slots sharing a rectangle resize as one cell.
`UVMap.unfold(id, net?)` lays out a region again through any net, even an unfolded one, and `"region-state-changed"` carries the `net` an unfold used.
