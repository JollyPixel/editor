---
"@jolly-pixel/engine": minor
---

Add `ShaderAssetType` and optional `shader` slots on `MeshDefinition` and `ModelDefinition`: renderers build a `ShadedMaterial` from per-component `uniforms`, updated live by `MeshRenderer.assignUniforms`; texture uniforms read `texture:<name>` slots.
`ComponentDefinition.capture` now receives the stored data, and `MeshRenderer.threeMesh` is typed `THREE.Mesh<THREE.BufferGeometry, THREE.Material>`.
