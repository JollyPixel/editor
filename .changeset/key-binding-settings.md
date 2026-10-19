---
"@jolly-pixel/controls": minor
---

Add `KeyBindingSettings`, which keeps a `KeyBindingMap`, loads stored overrides, emits each new map and rebinds handlers on change.
`KeyBindingMap` gains `rebind()`, `restore()`, `toJSON()` and static `parse()` and `from()` that drop invalid stored entries.
`KeyBindingMap.bind()` accepts handlers for a subset of the actions.
