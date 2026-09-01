---
"@jolly-pixel/three": minor
---

Added `PeerSelectionChips`/`PeerSelectionChip`, small colored billboard chips shown above an object with more than one simultaneous peer selector, so every selector is visible in the 3D view rather than only the primary (oldest) one - capped at 3 chips, with the rest collapsed into a "+N" overflow badge. Off by default (`enabled: false`), toggle via `setEnabled`. Also exported `computeLocalBoundingBox` (extracted from `SelectionBoundingBox`, no behavior change) for positioning the chip row.
