---
"@jolly-pixel/network": minor
---

Add `ConflictTracker`, a per-key wrapper around `ConflictResolver` that replaces the ad-hoc `Map` + get/resolve/set bookkeeping each `*SyncServer` (voxel-renderer, pixel-draw-renderer) used to repeat for itself.
