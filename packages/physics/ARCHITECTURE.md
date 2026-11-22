# Physics architecture

## One contract, one package per engine

```mermaid
flowchart TB
    Game["Game code, scene files"]
    Glue["physics/ecs<br/>PhysicsSystem, RigidBody"]
    Outline["physics/three<br/>ColliderOutline"]
    Contract["physics<br/>PhysicsWorld, PhysicsBody, shapes"]
    Rapier["physics.rapier"]
    Voxel["voxel.renderer<br/>PhysicsVoxelCollider"]

    Game --> Glue
    Game --> Outline
    Outline --> Glue
    Glue --> Contract
    Rapier -->|"implements"| Contract
    Voxel -.->|"types only"| Contract
```

- The contract imports nothing; a new engine is a new package beside
  `physics-rapier`.
- Engine-specific features stay reachable through each adapter's `native`
  field.
- Code: `src/` (contract), `src/ecs/` (renderer-agnostic engine
  components), `src/three/` (three.js collider outline), `src/testing/`
  (contract cases every backend runs). `three` is an optional peer, needed
  only by `./three`.
- One `RigidBody` owns one body and all its colliders, so no collider ever
  changes body. Hierarchy compounds (a collider on a child actor joining its
  parent's body) were dropped for that reason.
- `PhysicsSystem` maps each body to its owning actor through a `WeakMap`
  filled by `ownedBodies()`. A removed body needs no cleanup.
- The glue tests run on `FakePhysicsWorld`, which also runs the body
  lifecycle cases, so it cannot drift from the backends. A physics devDep on
  `physics.rapier` would create a workspace cycle.

## Who drives the pose

```mermaid
flowchart TB
    Script["fixedUpdate(): forces, impulses"]
    Kinematic["kinematic: actor pose to body"]
    Step["physics.step(fixedDelta)"]
    Dynamic["dynamic: body pose recorded"]
    Contacts["RigidBody.contactStarted / contactEnded"]
    Render["update(alpha): actor between last two poses"]

    Script --> Kinematic --> Step --> Dynamic --> Contacts
    Dynamic --> Render
```

- The world steps on the engine `World`'s `afterFixedUpdate`, once per fixed
  step.
- Physics only runs in play mode. In edit mode the scene definition builds
  the edit view it was given, such as `ColliderOutline`, which draws the
  colliders and creates no body.
