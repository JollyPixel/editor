---
"@jolly-pixel/controls": patch
---

Add an opt-in orbit-focus mode to `FreeFlyCamera` (`focusMode: "lock" | "elastic"`).
In "lock" mode, `enterOrbitFocus`/`exitOrbitFocus` engage a fixed, click-assigned
pivot (wired up in voxel-map via Alt+LeftClick, Escape to release); while locked,
WASD/arrows/Space/Shift smoothly nudge the pivot one cell at a time instead of
moving the camera freely. In "elastic" mode, WASD/look instead pilot a free-floating pivot
directly, and scroll smoothly trails the camera behind it, reaching the pivot
exactly (free-fly) at zero; scroll eases the same way in "lock" mode.
Alt+LeftClick-drag also rotates the view (in free-fly and
while orbiting) as a touchpad-friendlier alternative to middle-drag. The two
modes' state and math live in their own `OrbitFocus`/`ElasticFocus` classes.

Add the missing "Escape" key code to `KeyCode`, and prevent the browser
default for Alt+key combos (e.g. Chrome's Alt+D address-bar shortcut) so
they no longer steal focus away from a running game or editor.
