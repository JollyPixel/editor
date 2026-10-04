---
"@jolly-pixel/engine": patch
---

Declare `sideEffects: false` so bundlers drop three.js and reflect-metadata when only `Systems.Logger` is imported.
`ThreeRenderer` skips zero and unchanged sizes, so a canvas hidden then shown at the same size keeps its frame buffers.
