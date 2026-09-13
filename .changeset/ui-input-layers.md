---
"@jolly-pixel/ui": minor
---

Add `InputLayers` and the shared `inputLayers`: an open `jolly-dialog` or `PopoverController` popover claims keydown and keypress events.
Pass `inputLayers` to `Keyboard.addGuard()` so viewport controls ignore keys pressed inside dialogs and popovers.
