---
"@jolly-pixel/three": major
---

Renamed `ColoredOutlinePass` (and `ColoredOutlineEntry`/`ColoredOutlinePassOptions`/
`ColoredOutlineTarget`) to `HighlightPass`, and `PeerColoredOutlinePass`/
`PeerColoredOutlinePassOptions` to `PeerHighlightPass`; its `coloredOutline` constructor option is
now `highlight`. The `"coloredOutline"` `SelectionTechnique` is now `"highlight"`. Pure rename, no
behavior change.
