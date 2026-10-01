---
"@jolly-pixel/controls": minor
---

`Keyboard` gains `bind(chords, handler, options)` for prioritized key-chord bindings (also exported standalone as `KeyBindings`) and a ref-counted `suspend()`.
New `KeyChord` parses, matches and formats chords by position (`"Mod+KeyZ"`) or printed letter (`"Mod+z"`); `format({ layout })` names keys from `loadKeyboardLayout()`.
`isApplePlatform` is now exported.
