---
"@jolly-pixel/asset-server": major
"@jolly-pixel/pixel-draw.renderer": patch
"@jolly-pixel/voxel.renderer": patch
---

Remove the unused `sync`, `catalog`, `rooms`, `static` and `workspace` subpath exports; import from the package root instead.
Add a `kinds` entry exposing the asset kind handler contract, used by the renderer asset handlers.
