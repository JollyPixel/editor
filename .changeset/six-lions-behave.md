---
"@jolly-pixel/three": major
---

Removed `ToonOutlinePass`/`InstancedOutlineNode` and the `"toonOutline"` selection technique, now that `ColoredOutlinePass` strictly generalizes it: same technique, arbitrary colors instead of two fixed roles, no redundant whole-scene depth pre-pass. `SelectionManager`'s `toonOutline`/`toonOutlineOptions` options, `setToonOutlineOptions`, and `toonOutlineOptions` getter are gone; `"coloredOutline"` replaces `"toonOutline"` as the technique id that skips the per-object overlay. Renamed `PeerColoredOutline` to `PeerColoredOutlinePass` (fixes a naming asymmetry with its own `ColoredOutlinePass`) and gave it local-hover support.
