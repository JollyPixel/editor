---
"@jolly-pixel/three": patch
---

Silhouette highlights keep one `position` + `color` vertex layout, so a mesh that switches between a box and any other geometry no longer breaks WebGPU rendering.
