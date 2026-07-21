---
"@jolly-pixel/pixel-draw.renderer": minor
---

Improve trackpad navigation. In `"move"` mode a plain single-finger left-drag now pans the camera (no keyboard chord — the trackpad-friendly way to move around). Additionally: hold `Space` and left-drag to pan from any mode, trackpad pinch zooms toward the cursor, and wheel zoom now scales with delta magnitude (normalized across `deltaMode`) so fine-grained deltas zoom smoothly instead of jumping a full notch per event. Pan gestures (middle-drag, `Space`+drag, or a `"move"`-mode drag) show a `grab`/`grabbing` cursor.
