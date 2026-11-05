---
"@jolly-pixel/engine": major
"@jolly-pixel/three": major
"@jolly-pixel/voxel.renderer": major
---

Move `BakedRoomEnvironment` from `three` to the engine as `Systems.BakedRoomEnvironment`; the engine drops `picomatch`, `reflect-metadata` and `@jolly-pixel/three`, and a decorated `Behavior` subclass no longer adds its properties to its parent class.
Breaking: `getActors` and `Logger` patterns only support `*`, `?` and `**` (no braces, classes or extglobs, and `*` matches a leading dot).
Breaking: `three` no longer exports `BakedRoomEnvironment`, and `three` and `voxel.renderer` take `three` as a `^0.186.0` peer dependency.
