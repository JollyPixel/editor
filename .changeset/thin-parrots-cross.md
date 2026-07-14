---
"@jolly-pixel/engine": patch
"@jolly-pixel/runtime": patch
---

Bump the `three` peer dependency from `0.182.0` to `^0.185.1` to match the rest of the monorepo. The mismatched pin caused npm to install two separate copies of three.js, which broke `WebGLRenderer.renderBufferDirect` (`object.matrixWorld.determinantAffine is not a function`) whenever objects built by the engine's copy of three were rendered through a renderer/helper (e.g. `ViewHelper`) created from the other copy.
