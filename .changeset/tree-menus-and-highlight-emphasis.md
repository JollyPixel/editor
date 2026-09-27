---
"@jolly-pixel/ui": minor
"@jolly-pixel/three": minor
---

Add `jolly-context-menu` (a point or `AnchorRect` anchor) and `resolveReparentMoves()`; `jolly-tree` emits `jolly-context-request` on right-click or Shift+F10, samples rows with `TreeNode.swatch` (`jolly-activate-swatch`) and exposes a `grip` part.
Locked fields no longer reflow and peer chips skip their own user; pane `actions` buttons no longer start a drag, clicks in the rename field keep it open, and `jolly-dialog` accepts `--jolly-dialog-backdrop-filter`.
`MeshHighlight` gains `emphasize(ids)`, `emphasized` and `emphasisChange`; `ObjectOverlayRenderer` takes an optional `renderScene`, without which `render` only places the overlays.
