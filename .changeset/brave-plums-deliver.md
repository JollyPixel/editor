---
"@jolly-pixel/three": major
---

Removed `SelectionHighlight` and the `"highlight"` selection technique - its Fresnel-rim look doesn't hold up on hard-edged geometry, and `ColoredOutlinePass` now gives a cleaner silhouette rim on any geometry, smooth or faceted, without the trade-off. `MergedSelectionOverlay` and `SelectionOverlayCreateOptions` also drop their `style`/`thickness` fields, since only one per-object overlay style (`"outline"`) remains.
