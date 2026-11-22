# AGENTS.md

## Boundaries

Never import `three`, `@jolly-pixel/backend.three` or `@jolly-pixel/runtime`.
pnpm's isolated `node_modules` make such an import fail typecheck.

## Scene lifecycle gotchas

- `loadScene()` never activates at once. A ready load activates on the next
  `sceneManager.beginFrame()`: `scene.awake()` and the actor awakes run there,
  then the scene's `start()`. `await load.done` resolves before any of them,
  so a test ticks a frame before asserting actor state.
- An actor created after `world.connect()` awakes on the next `beginFrame()`,
  not at creation. Its components start in that same `beginFrame()`, after
  the awake.
- `fixedUpdate()` and `update()` only visit actors that already held a
  component with `needUpdate` when the frame began.

## Types and math

- `declare module "@jolly-pixel/ecs"` merges only into top-level exports, not
  into members of `Systems`. A type a backend augments must be exported at the
  top level, as `SceneBackend` is.
- A quaternion check through `|dot| > 1 - ε` passes for a non-unit
  quaternion; assert the unit length too.
