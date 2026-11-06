# @jolly-pixel/physics.rapier

A `@jolly-pixel/physics` backend running [Rapier][rapier]
(`@dimforge/rapier3d-compat`). The WebAssembly module is inlined, so it loads
in browsers and Node.js with no bundler setup.

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/physics @jolly-pixel/physics.rapier
# or
$ yarn add @jolly-pixel/physics @jolly-pixel/physics.rapier
```

## 👀 Usage example

```ts
import { RapierBackend } from "@jolly-pixel/physics.rapier";

const backend = await RapierBackend.load();
const world = backend.createWorld();

const ball = world.createBody({
  kind: "dynamic",
  position: { x: 0, y: 5, z: 0 }
});
ball.attach({
  shape: {
    type: "sphere",
    radius: 0.5
  }
});

world.step(1 / 60);
console.log(ball.position.y);
```

## 📚 API

**RapierBackend** is the **PhysicsBackend** of `@jolly-pixel/physics`.

### static load()

```ts
static load(): Promise<RapierBackend>
```

Initializes the Rapier WebAssembly module, once per page or process, and
returns a backend. Create backends through `load()` only.

### createWorld(options?)

```ts
createWorld(options?: PhysicsWorldOptions): RapierWorld
```

Creates a world. `RapierWorld`, `RapierBody` and `RapierCollider` implement
`PhysicsWorld`, `PhysicsBody` and `PhysicsCollider`.

### Native objects

```ts
class RapierWorld { readonly native: RAPIER.World; }
class RapierBody { readonly native: RAPIER.RigidBody; }
class RapierCollider { readonly native: RAPIER.Collider; }
```

Use `native` for Rapier features the contract does not cover, such as joints
or the character controller. Removing or freeing a native object behind the
wrapper's back leaves the wrapper broken. Kinematic bodies are Rapier's
position-based kinematic bodies.

## 🔍 Rapier specifics

Where the contract leaves a case open, Rapier decides:

- `drainContacts()` reports no contact between two bodies that are each fixed
  or kinematic.
- `castRay()` treats shapes as solid: a ray starting inside a collider hits it
  at distance 0.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[rapier]: https://rapier.rs
[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
