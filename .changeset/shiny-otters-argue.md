---
"@jolly-pixel/three": minor
---

Rename `SelectionManager`'s `meshStyle`/`setMeshStyle`/`styleFor`/`MeshSelectionStyle` to `technique`/`setTechnique`/`techniqueFor`/`SelectionTechnique`, and open per-object overlay techniques (`"outline"`/`"highlight"`/`"boundingBox"`) into a registerable `SelectionOverlayRegistry` instead of a closed switch.
