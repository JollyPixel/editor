---
"@jolly-pixel/three": major
---

`CameraGizmo` and `PeerFrustum` draw 2 px outlined lines that stay crisp at any distance and on busy backgrounds, with hidden parts dimmed.
`PeerFrustum` now extends `THREE.Group`, so its `geometry` and `material` are gone; use `color` and `opacity`.
Raycasts hit these lines only on their drawn pixels and only from a raycaster with a `camera`.
