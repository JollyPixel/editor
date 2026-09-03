---
"@jolly-pixel/ui": minor
---

`jolly-floating` persists `hidden` with its geometry, and `Pane` takes a
`storageKey` option pinning the namespace it persists under. The voxel-map
performance HUD uses both, so `F3` and its fold survive a reload.
