# @jolly-pixel/physics

An engine-neutral physics contract, and the components that plug it into the
JollyPixel engine. The simulation itself comes from a [backend](#backends).

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/physics
# or
$ yarn add @jolly-pixel/physics
```

## 👀 Usage example

The example below uses the Rapier backend.

```ts
import { Runtime } from "@jolly-pixel/runtime";
import {
  PhysicsSystem,
  RigidBody
} from "@jolly-pixel/physics/engine";
import { RapierBackend } from "@jolly-pixel/physics.rapier";

const { world } = await Runtime.create("canvas");
PhysicsSystem.attach(world, await RapierBackend.load());

world.createActor("ground")
  .addComponent(RigidBody, {
    kind: "fixed",
    colliders: [
      {
        shape: {
          type: "box",
          halfExtents: { x: 10, y: 0.5, z: 10 }
        }
      }
    ]
  });

const crate = world.createActor("crate");
crate.object3D.position.set(0, 5, 0);
crate.addComponent(RigidBody);
```

The crate, a unit box by default, falls and lands on the ground; its actor
follows the body.

## Backends

Install one next to this package.

- `@jolly-pixel/physics.rapier`: Rapier (`@dimforge/rapier3d-compat`).

## 📚 API

[ARCHITECTURE.md](ARCHITECTURE.md) shows how the pieces fit and when the world
steps.

### Contract

```ts
import { PhysicsWorld } from "@jolly-pixel/physics";
```

- [`PhysicsWorld`](docs/PhysicsWorld.md): backend, world, stepping, contacts and
  ray casts
- [`PhysicsBody`](docs/PhysicsBody.md): bodies and colliders
- [`ColliderShape`](docs/ColliderShape.md): shapes and collider options

### Engine

```ts
import { RigidBody } from "@jolly-pixel/physics/engine";
```

- [`PhysicsSystem`](docs/engine/PhysicsSystem.md)
- [`RigidBody`](docs/engine/RigidBody.md)
- [`ColliderOutline`](docs/engine/ColliderOutline.md)

### Testing

```ts
import { SIMULATION_CASES } from "@jolly-pixel/physics/testing";
```

- [Backend contract cases](docs/testing.md): the cases a backend runs in its
  own test suite

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
