---
"@jolly-pixel/voxel.renderer": minor
---

Performance pass over voxel storage and meshing. On the 1024² noise-terrain benchmark (3,050,267 voxels, chunk 256, minimum of three runs) voxel generation drops 614 → 436 ms and meshing 1637 → 998 ms naive / 2455 → 1656 ms greedy, with byte-identical geometry. Resident buffers fall 523 → 445 MB naive and 358 → 326 MB greedy.
