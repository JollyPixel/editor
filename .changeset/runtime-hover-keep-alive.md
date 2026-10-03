---
"@jolly-pixel/runtime": patch
---

With `renderOnDemand`, the runtime keeps rendering while the pointer hovers the canvas instead of idling a few frames after the last input.
An idle runtime now samples connected gamepads once per animation frame and wakes on a press, so the first press is no longer missed.
