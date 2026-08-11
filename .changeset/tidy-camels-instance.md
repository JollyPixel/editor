---
"@jolly-pixel/three": minor
---

Add instance-aware selection outlining and a merged bulk-selection overlay:

- `MergedSelectionOverlay` merges many simultaneously selected/highlighted meshes into a single draw call, for bulk multi-select scenarios outside `SelectionManager`'s own single-selection model.
- `ColoredOutlinePass` accepts an `instanceId` on `ColoredOutlineEntry` to outline individual instances of a `THREE.InstancedMesh`, at a fixed cost regardless of how many instances are outlined at once.
- `ToonOutlinePass`/`InstancedOutlineNode` (a maintained fork of three's own `OutlineNode` with per-instance selection support) do the same for the postprocess toon-outline style - `setSelected`/`setSelectedMany`/`setHovered` now accept `{ mesh: THREE.InstancedMesh; instanceId: number }` alongside whole objects.
