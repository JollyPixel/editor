---
"@jolly-pixel/ui": minor
---

`inputLayers.push()` accepts `{ dismiss }` and `inputLayers.dismissAll()` closes every open layer, returning `false` when one refuses.
`jolly-dialog` dismisses through its cancel path unless `dismissible` is `false`; `PopoverController` popovers dismiss by hiding.
New `adoptAmbientTheme(element, adopted)` sets an element's `theme` attribute to its ambient theme unless the author set one.
