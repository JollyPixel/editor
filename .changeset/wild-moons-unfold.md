---
"@jolly-pixel/pixel-draw.renderer": major
---

Add an `unfolded` UV region state that packs the active faces into a net and
drags them as one, and rename the pair around it: `collapsed` is now `stacked`
and `uncollapsed` is now `free`. `UVMap.collapse()`/`uncollapse()` are replaced
by `setState(id, state, face?)`, `UVRegion` gains `stack()`/`unfold()`/`free()`
plus `bounds` and `translated()`, and `state` is required on `UVRegionData`, so
documents written with the old names no longer load. The pixel-art toolbar
swaps its single toggle for a state dropdown, and unfolding a voxel-map block
claims one atlas tile per face.
