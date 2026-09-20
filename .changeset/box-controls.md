---
"@jolly-pixel/three": major
---

Rename `AreaBoxControls` to `BoxControls<TBox>` (`area` becomes `box`), which
now also drives `MarqueeBox`; `Area*` policy, drag and state types take a `Box`
prefix. `AreaBox` and `MarqueeBox` share a new `BoxVolume` base.
