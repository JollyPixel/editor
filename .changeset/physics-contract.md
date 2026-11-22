---
"@jolly-pixel/voxel.renderer": major
---

Add `@jolly-pixel/physics`, an engine-neutral physics contract with `PhysicsSystem` and `RigidBody` components (`./ecs`), a three.js `ColliderOutline` (`./three`) and backend contract cases, and `@jolly-pixel/physics.rapier`, its Rapier backend.
`RapierVoxelCollider` is replaced by `PhysicsVoxelCollider`, which takes any `@jolly-pixel/physics` world (now an optional peer dependency).
`ComponentDefinition.apply` may return `false` to ask for a rebuild; `RigidBodyDefinition` builds the edit view it is given, such as `ColliderOutline`, in edit mode.
