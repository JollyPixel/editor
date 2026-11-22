---
"@jolly-pixel/runtime": patch
"@jolly-pixel/physics": patch
---

`RuntimeCore` assigns its world to `globalThis.game`, which the ECS `World` no longer does.
`RigidBodyEditView` extends `ActorComponent`, the ECS `Component` interface being gone.
