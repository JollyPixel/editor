---
"@jolly-pixel/editor.voxel-model": minor
---

Migrate onto `@jolly-pixel/engine`'s Runtime/Scene/ActorComponent architecture (WebGPU), porting voxel-map's elastic-focus camera.
Wire the shared pixel-draw panel for per-cube UV authoring: each cube gets an auto-created, per-face UV region on creation, kept in sync with viewport and tree selection.
Align the panel layout and styling with the rest of the editor UI.
