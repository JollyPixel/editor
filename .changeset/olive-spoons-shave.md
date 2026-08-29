---
"@jolly-pixel/three": patch
---

Stop faulting the WebGPU queue from object-layer edits: `AreaBoxEdges.resize()`
drops a resize to the size it already traces, and hiding an object or a layer
now flips `visible` instead of disposing the area mid-frame.
