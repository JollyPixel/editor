---
"@jolly-pixel/controls": minor
"@jolly-pixel/engine": minor
---

`Mouse.scrollSource` tells wheel notches, two-finger touchpad swipes and zooms (pinch or Ctrl+wheel) apart; `scrollDevice` overrides the detection.
`OrbitFlyCamera` looks around on a two-finger swipe and with I/J/K/L (`touchpadLookSensitivity`, `keyLookSpeed`); a pinch does what the wheel does.
`OrbitFlyCamera` eases in and out of movement (`accelerationTime`, `brakingTime`); `responsiveness` now only damps the pivot and trail.
