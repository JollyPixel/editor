# AGENTS.md

## Boundaries

Never import `three`, `@jolly-pixel/backend.three` or `@jolly-pixel/runtime`:
the ECS stays renderer-agnostic.

## Scene lifecycle gotchas

- Nothing runs at creation. Actors awake, components start and scene loads
  activate on the next `sceneManager.beginFrame()`; `await load.done`
  resolves before any of it. A test ticks a frame before asserting.

## Types and math

- `declare module "@jolly-pixel/ecs"` merges only into top-level exports, not
  into members of `Systems`. A type a backend augments must be exported at the
  top level, as `SceneBackend` is.
- A quaternion check through `|dot| > 1 - ε` passes for a non-unit
  quaternion; assert the unit length too.
- Never declare lifecycle hooks on `ActorComponent`: `noImplicitOverride` would
  force `override` on every script. Engine code calls them through
  `HookedComponent`.
