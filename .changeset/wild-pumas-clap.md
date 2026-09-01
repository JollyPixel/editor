---
"@jolly-pixel/three": patch
---

Stop `AreaBoxEdges` faulting the WebGPU queue on a canvas resize: the material
is now transparent only below a full opacity, so fully opaque edges no longer
pull in the full-screen opaque copy that three recreates mid render pass.
