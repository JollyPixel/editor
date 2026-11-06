---
"@jolly-pixel/engine": minor
"@jolly-pixel/voxel.renderer": major
---

Add `@jolly-pixel/physics`, an engine-neutral physics contract with `PhysicsSystem` and `RigidBody` engine components and backend contract cases, and `@jolly-pixel/physics.rapier`, its Rapier backend.
`RapierVoxelCollider` is replaced by `PhysicsVoxelCollider`, which takes any `@jolly-pixel/physics` world (now an optional peer dependency).
`ComponentDefinition.apply` may return `false` to ask for a rebuild; the scene `RigidBody` draws a `ColliderOutline` in edit mode.
