---
"@jolly-pixel/three": patch
---

Fixed `SelectionOutline` losing its outline on concave-relative-to-origin surfaces (a torus's inner hole-facing rim, a torus knot's inward-facing grooves) - it now offsets each edge vertex along its own local surface normal instead of scaling the whole outline outward from the object's origin, which pushed those specific edges into the mesh instead of off it.
