# ColliderOutline

An actor component that draws the colliders of a `RigidBody` from
`@jolly-pixel/physics/ecs` as three.js lines, at the size the body gets. It
creates no body and needs no `PhysicsSystem`. Passed to `RigidBodyDefinition`,
it is the edit view of scene rigid bodies; a game can add one next to a
`RigidBody` to see its colliders.

It lives in its own entry point so that games without physics do not need
`@jolly-pixel/physics`, an optional peer dependency of this package.

```ts
import { RigidBody } from "@jolly-pixel/physics/ecs";
import { ColliderOutline } from "@jolly-pixel/backend.three/physics";

const crate = actor.addComponentAndGet(RigidBody);
actor.addComponent(ColliderOutline, crate.settings);
```

## Constructor

### new ColliderOutline(actor: Actor, settings: RigidBodySettings)

Only `settings.colliders` is drawn.

## Properties

```ts
class ColliderOutline {
  readonly settings: Readonly<RigidBodySettings>;
  shown: boolean; // default true
}
```

## Methods

### draw(settings: RigidBodySettings): void

Replaces the settings and redraws.

## Behaviour

- The lines follow the actor's world position and rotation. Shapes are scaled
  the way `RigidBody` scales them, so a sphere on a stretched actor stays a
  sphere.
- The outline is redrawn when the actor's world scale changes. Nothing is
  drawn while one axis of the scale is zero.
- Lines draw on top of the scene, without depth test: green for solid
  colliders, amber for sensors.
- Destroying the component removes the lines.
