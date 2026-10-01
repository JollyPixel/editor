---
"@jolly-pixel/ui": minor
---

`ContextMenuItem` takes `intent: "danger"`, and `PopoverController.show()` places a popover before its first frame.
Overlay popovers scale from their anchor; the context menu renders, places and focuses its items as `openAt` runs.
