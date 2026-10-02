---
"@jolly-pixel/image": patch
---

Faster PNG encoding and decoding: specialized branchless scanline filters, a single-pass adaptive filter score, SWAR unfiltering, palette lookup tables, a zero-copy RGBA path, slicing-by-8 CRC-32, and inflation into a preallocated buffer.
