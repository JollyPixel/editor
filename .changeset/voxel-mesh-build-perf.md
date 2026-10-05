---
"@jolly-pixel/voxel.renderer": patch
---

Faster chunk meshing with identical output: ambient occlusion samples and quad diagonals are memoized, blend neighbours and palette entries are cached, and block variants use a flat lookup table.
Less memory and GC work: face textures no longer pad rows (~20% smaller), chunk geometries share their corner attributes, and `VoxelChunkCollision.geometries` is built only when a collider reads it.
Transactions track edited cells sparsely, so a small edit no longer allocates arrays sized to every touched chunk.
