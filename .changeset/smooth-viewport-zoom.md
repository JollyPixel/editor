---
"@jolly-pixel/pixel-draw.renderer": major
---

Wheel zoom is now multiplicative and eased around the cursor (`zoom.smoothing`, `zoom.target`), snaps near whole levels, and keeps the camera on whole pixels.
Breaking: `zoom.sensitivity` is now the relative change per notch (default `0.25`), halving toward `max`.
