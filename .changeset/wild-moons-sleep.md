---
"@jolly-pixel/ui": minor
---

`jolly-folder` gains an `actions` slot that puts buttons in its header, next to
the grip, and a `plus` builtin glyph. The voxel-map block library moves its add
and edit buttons there, dropping the toolbar row that sat above the grid.

Fields gain a `--jolly-label-max-width` property over the fixed 45% label cap,
and an unlabeled `jolly-button-group` falls back to its `aria-label`. The block
library uses both to fit rotation and Flip Y on one row.
