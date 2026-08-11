# InstancedOutlineNode

Fork of three's own `OutlineNode` (`three/addons/tsl/display/OutlineNode.js`,
ported from the version shipped with three@0.185.1), extended with
per-instance selection support for a `THREE.InstancedMesh`. Backs
[ToonOutlinePass](./ToonOutlinePass.md) - most consumers should reach for
that class instead of this one directly; this doc exists mainly to explain
*why* this fork exists and how to keep it in sync with upstream three.js.

## Why a fork, not a wrapper

`OutlineNode`'s algorithm is a two-pass technique run in its own private
`updateBefore()`:

1. Render every **non-selected** object into a depth buffer.
2. Render only the **selected** objects, comparing each fragment against
   that depth buffer to split visible vs. occluded edges.

Both passes decide what to draw via `Set<Object3D>` identity - `object in
the set` or not, nothing in between. A `THREE.InstancedMesh` breaks that
assumption: it's one `Object3D` that draws many distinct instances in one
call, so "is this object selected" has no single answer once some but not
all of its instances are. There's no public seam to teach the upstream class
a different answer - `updateBefore()`, the render-target/material setup, and
the selection cache are all private implementation details of that one
method - so representing "some instances of this object" requires changing
that method's own logic, not composing around it.

`InstancedOutlineNode` adds a second, parallel selection list -
`selectedInstances: { mesh: THREE.InstancedMesh; instanceId: number }[]` -
alongside the original `selectedObjects: Object3D[]`. For any `InstancedMesh`
referenced there, both passes swap in a per-mesh material that discards
fragments by instance instead of by object:

- **Pass 1** discards the *selected* instances' fragments (so the depth
  buffer represents "the world minus the selection", same intent as
  excluding a selected whole object).
- **Pass 2** discards the *non-selected* instances' fragments, then applies
  the exact same depth-comparison expression (`#prepareMask()`) the
  whole-object materials use.

Each discard is driven by a dedicated `THREE.InstancedBufferAttribute` (one
float per instance, `1` = selected) read via TSL's `instancedBufferAttribute()`
- the same low-level technique three's own `instance()` helper uses
internally for `InstancedMesh.instanceColor`, just aimed at a buffer this
class owns instead (deliberately not `instanceColor` itself - three
auto-multiplies *any* material's diffuse color by `instanceColor` when it's
set, which would leak into the mesh's own normal scene rendering). The
materials and attribute are built lazily per `InstancedMesh` and reused
across frames - only rewritten when its selected-instance set changes, never
recompiled just because the selection did.

## Everything else is unchanged from upstream

Render-target shapes, the edge-detection/blur/composite chain, and the
whole-object path (`selectedObjects`) are intentionally kept as close to
`OutlineNode.js` as possible, so a future three.js upgrade can be diffed
against the vendored source at
`node_modules/three/examples/jsm/tsl/display/OutlineNode.js` to see what
changed upstream and reapply it here by hand. If you're upgrading `three`
and this file needs revisiting, that vendored file is the reference.

## InstancedOutlineSelection

```ts
export interface InstancedOutlineSelection {
  mesh: THREE.InstancedMesh;
  instanceId: number;
}
```

## Usage

Most consumers won't construct this directly - see
[ToonOutlinePass](./ToonOutlinePass.md), which owns two of these (selected +
hover) and exposes a friendlier `setSelected`/`setSelectedMany`/`setHovered`
API accepting whole objects and instanced targets interchangeably. Direct
usage matches three's own `outline()` factory:

```ts
import { instancedOutline } from "@jolly-pixel/three";

const outlinePass = instancedOutline(scene, camera, {
  selectedObjects: [wholeMesh],
  selectedInstances: [{ mesh: instancedMesh, instanceId: 7 }]
});

// compose outlinePass.visibleEdge / .hiddenEdge into a RenderPipeline,
// same as three's own OutlineNode - see ToonOutlinePass's own constructor
// for a worked example.
```

## Notes

- Several `selectedInstances` entries may reference the same `mesh` - they merge into one per-mesh selected-instance set, the same way `selectedObjects` naturally merges via `Set` identity.
- Cost per referenced `InstancedMesh` stays at the same two draw calls (one per pass) regardless of how many of its instances are selected at once - the per-instance discard happens inside those two draws, not as one draw per instance.
- Most internal TSL-graph-holding fields/methods are left without an explicit TypeScript type annotation, relying on this repo's `noImplicitAny: false` (see AGENTS.md) rather than fighting TSL's heavily-overloaded node types (`vec3`, `texture`, `reference`, ... each resolve to a different concrete type per call site, which a single `ReturnType<typeof X>` annotation can't express) - only genuinely-public fields keep real types. A few casts bridge places where three's own `.d.ts` is stricter (or looser) than its actual runtime contract (e.g. `RendererUtils.resetRendererAndSceneState`'s declared 2-param shape vs. its actual 3-param runtime signature) - each is commented with why at its call site.
- See `examples/scripts/demo-stress.ts` (run `npm run dev`, open `/stress.html`) for the motivating case: the entire stress grid is one `THREE.InstancedMesh`, and "toon outline (postprocess)" outlines individual instances of it through `ToonOutlinePass`.
