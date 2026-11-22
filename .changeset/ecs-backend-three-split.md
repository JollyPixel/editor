---
"@jolly-pixel/runtime": major
"@jolly-pixel/voxel.renderer": major
---

Replace `@jolly-pixel/engine` with `@jolly-pixel/ecs`, a renderer-agnostic actor and scene core, and `@jolly-pixel/backend.three`, which holds every three.js piece and the browser `Runtime`.
Breaking: `@jolly-pixel/runtime` now only exports `RuntimeCore`, its backend contract, the overlay and the metrics, from its root entry. `voxel.renderer/engine` takes `@jolly-pixel/ecs` and `@jolly-pixel/backend.three` as optional peers.
