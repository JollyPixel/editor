---
"@jolly-pixel/ui": minor
---

`jolly-transform` gains `rotation-format="euler"`: the rotation row then edits `{ x, y, z }` in degrees, as stored, instead of a quaternion.
A row's own `jolly-input`/`jolly-change` no longer leaks past the transform; the merged event's detail now names the edited row in `field`.
