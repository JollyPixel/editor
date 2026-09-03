---
"@jolly-pixel/ui": minor
---

`addBinding` now dispatches vector, quaternion and point2d fields from a value's
own axes, writing back component-wise so a bound `THREE.Vector3` keeps its
identity. Adds `Pane` `labelWidth`, color `alpha`, vector monitors and
`onFieldChange`.
