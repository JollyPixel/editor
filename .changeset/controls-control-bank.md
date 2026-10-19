---
"@jolly-pixel/controls": major
---

Breaking: devices share one edge bank, so a tap between two samples reports both edges; device state arrays, `Mouse.newPosition`/`newDelta`/`synchronizeWithTouch`, `Screen.requestFullscreenIfWanted`, `Keyboard.enabled`, condition `bind()` (use `bindInputCondition()`), `KeyBindingSettings.sync()` and `InputActionQuery` are removed.
Mouse follows the first touch and Screen its own gestures, so fullscreen now completes on touch; Touchpad allocates slots, the Gamepad `Home` button works, conditions take `InputDevices`, and `KeyboardLayoutStore` is exported.
`Keyboard.wasDownLastUpdate()` lets aliases report a tap then a hold in one frame, mouse scroll queries share one edge, and `Input` device fields are readonly.
