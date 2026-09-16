---
"@jolly-pixel/ui": minor
---

Add `double` to `jolly-dock`: a left or right dock can open a second column, which doubles its width and splits it equally between the two columns.
`DockState` gains `secondary`, `PanePlacement` gains `column`, and `movePane`/`stackPane` accept a `DockAddress` (`{ dock, column }`).
