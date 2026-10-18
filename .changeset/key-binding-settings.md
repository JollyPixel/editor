---
"@jolly-pixel/controls": minor
---

Add `KeyBindingSettings`, which keeps a `KeyBindingMap` saved to a storage, emits each new map and rebinds handlers on change.
`KeyBindingMap` gains `rebind()`, `restore()`, `toJSON()` and a static `parse()` that drops invalid stored entries.
`KeyBindingMap.bind()` accepts handlers for a subset of the actions.
