# Actor/Component vs. ECS: closing the data-oriented gap

A structural audit of `@jolly-pixel/engine`'s Actor / ActorComponent / World stack, benchmarked against ESEngine's bitmask-query design and bitECS's SoA storage model — with a concrete, incremental path to a flexible, genuinely performant core.

- **Scope** — `packages/engine`: `Actor`, `ActorComponent`, `ActorTree`, `World`, `SceneManager`, `Scene`, `Transform`, `Signal`
- **Compared against** — ESEngine (bitmask + incremental query cache), bitECS (SoA, archetype-free)
- **Verdict** — currently a Component pattern on Three.js, not an ECS

## Contents

1. [Where the engine actually stands](#1-where-the-engine-actually-stands)
2. [Three-way comparison](#2-three-way-comparison)
3. [Findings, by severity](#3-findings-by-severity)
4. [Storage model — what "flexible SoA/AoS" should actually mean here](#4-storage-model--what-flexible-soaaos-should-actually-mean-here)
5. [Roadmap](#5-roadmap)
6. [What not to change](#6-what-not-to-change)
7. [Sources](#7-sources)

## 1. Where the engine actually stands

Read plainly, not as a value judgement.

`Actor` (`actor/Actor.ts`) is a class instance that owns a live `THREE.Group` (`object3D`), a flat `components: Component[]` array, and a second array, `componentsRequiringUpdate`, that a component pushes itself onto when its `needUpdate` setter flips true. `ActorComponent` is a base class every gameplay component extends; identity is a monotonic `id` (`IntegerIncrement`) plus a `persistentId`. Component lookup — `getComponent`, `getComponents` — is a linear scan of the owning actor's array, using either a string `typeName` compare or `instanceof`.

There is no entity registry independent of `Actor`, no component storage independent of the actor that owns it, and no query engine. `SceneManager.update()` walks a cached array of registered actors and calls `actor.update(dt)`, which iterates that actor's own `componentsRequiringUpdate` array and calls `.update?.()` on each. A "system" that wants to act on "all entities with Velocity and Health" doesn't exist as a concept — the closest equivalent is a `Behavior` subclass sitting on one actor, reading its own siblings via `getComponent`.

This is a textbook **Component pattern** (per-object heterogeneous behavior composition, GoF/game-engine flavor) wired directly onto Three.js's scene graph. It is not an Entity-Component-System in the sense either reference implementation uses the term: there's no data/logic separation enforced at the type level, no query layer, and every actor carries a full `THREE.Object3D` whether or not anything about it needs rendering.

> That's not automatically wrong — it's a defensible, DX-friendly design for an editor-first, Three.js-native engine. The problem is specifically that it has **no escape hatch**: there's exactly one storage shape (one object per component, per actor, in a JS array) and exactly one iteration path (walk the actor tree, walk each actor's array). Nothing here can become data-oriented without becoming a different system.

## 2. Three-way comparison

JollyPixel today, ESEngine (fetched from its docs), and bitECS (SoA-first, the reference for "how far can this go").

| Axis | JollyPixel (current) | ESEngine | bitECS |
|---|---|---|---|
| Entity identity | `id` (monotonic) + `persistentId`, no staleness check | `id` + `persistentId` (GUID) + `EntityHandle {index, generation}` | plain `number`, generation-checked internally via a free-list |
| Component storage | class instance, referenced from `actor.components[]` | class instance, referenced from a per-entity bitmask + slot | **SoA** — component = object of `TypedArray`s, indexed by entity id |
| Component identity | string `typeName` or class ref; `instanceof` for lookup | registry-assigned bitmask bit via `@ECSComponent` | registered component object, mapped to a bit internally |
| Query system | none — manual `getComponent`/`getComponents` scan per call site | `Matcher` (declarative) + `QuerySystem` (incrementally-cached results) | `defineQuery([Position, Velocity])`, cached, archetype-free bitmask match |
| Iteration | tree walk → per-actor array walk, both plain arrays/generators | system's cached `entities`, snapshotted per `process()` | query returns a flat `Uint32Array` of entity ids; tight loop over typed arrays |
| Structural-change safety | none — `needUpdate` setter splices the array it's iterated with | per-frame snapshot + optional `CommandBuffer`, flushed after all systems | caller's responsibility; typically deferred via a command queue in userland |
| Change detection | none | epoch counter + `lastWriteEpoch` per component, `forEachChanged` | not built in (left to userland / bitECS-based libs) |
| Batch creation | none — one `new Actor()` at a time | `scene.createEntities(n)`, amortized cache update | N/A, entity creation is a cheap integer allocation already |
| Hierarchy | built into `Actor`/`ActorTree` (every actor has parent/children) | opt-in — `HierarchyComponent` + `HierarchySystem`, most entities pay nothing | not part of core; left to the consuming engine |
| Reference safety | direct object refs everywhere (`parent: Actor`, `actor: Actor` in every component) | ID by default; opt-in `@EntityRef()` tracked reference, nulled on destroy | plain integer ids; dead id detection is explicit (generation check) |

## 3. Findings, by severity

Ordered by how much they block "flexible, good-DX, actually fast" — not by how easy they are to fix.

### Critical — No query layer — every "system" hand-rolls its own scan

There is no way to ask the engine "give me every actor with `Health` and `Velocity` but not `Dead`." The only primitives are `actor.getComponent(Type)` (single actor, linear scan, `instanceof`) and `tree.walk()` (full recursive tree traversal). Any cross-actor system today is built by walking the whole tree and filtering by hand, every frame, in every system that needs it. This is the single biggest gap relative to *both* reference designs — it's the piece that turns "component pattern" into "ECS," and it's also the thing that makes SoA storage useful later (a query is what decides which rows of a typed array to touch).

ESEngine's answer (`Matcher` + incrementally-maintained `QuerySystem`) and bitECS's answer (`defineQuery` over a bitmask, returning a flat id array) converge on the same shape: **a declarative filter, evaluated once, kept live via incremental updates on component add/remove**, not re-scanned every call.

### Critical — Component identity is a string or a class reference, not a bit

`components/types.ts`: `typeName: FreeComponentEnum` is `StrictComponentEnum | (string & {})` — an open string union. `getComponent(typeName: string)` compares strings; `getComponent(componentClass)` falls through to `instanceof`. Both are the "slow path" in ESEngine's own vocabulary (its docs draw this exact distinction and call the bitmask lookup the fast path). Without a registry that assigns each component type a stable bit, there's no cheap way to test "does this entity have components A and B," which is the operation a query engine is built on. This is upstream of the query-layer gap above — you can't build a fast `Matcher`-equivalent on top of string comparisons.

### Critical — Structural mutation during iteration is unguarded

`ActorComponent.needUpdate`'s setter (`actor/ActorComponent.ts:54-70`) pushes/splices `actor.componentsRequiringUpdate` synchronously and unconditionally — including from inside a component's own `update()`. `Actor.update()` iterates that same array with `.forEach()`. If component A's `update()` sets `needUpdate = false` on component B that hasn't run yet this frame, B silently gets skipped (splice shifts indices under a live `forEach`); if A adds a new component with `needUpdate = true`, it may or may not run this frame depending on where the splice landed. Neither ESEngine nor bitECS lets userland code mutate the live iteration set directly — ESEngine snapshots per `process()` call and additionally offers a `CommandBuffer` that defers `addComponent`/`removeComponent`/`destroyEntity` to a single flush after all systems run that frame.

### High — No generational handle — a held `Actor`/`ActorComponent` reference never goes stale-safe

Every reference to an actor or component in this codebase is a live object reference: `actor: Actor` on every component, `parent: Actor | null`, behaviors keyed by constructor name holding direct instances. Nothing stops code from holding onto a destroyed `Actor` and calling a method on it — `pendingForDestruction` is checked in some places (`update`, `fixedUpdate`) but not others, and a destroyed actor's fields aren't nulled out, just left dangling with stale `parent`/`children` state. ESEngine's `EntityHandle {index, generation}` exists precisely for "hold a reference across frames, fail loud on staleness instead of reading garbage" — `scene.findEntityByHandle()` returns `null` on a generation mismatch instead of resolving to whatever recycled the slot.

### High — Per-call allocation in the hottest per-frame path

`Transform` methods routinely allocate: `getGlobalPosition()` defaults to `new THREE.Vector3()`, `lookAt()` allocates a fresh `Matrix4`/`Vector3`/`Vector3` every call, `getParentGlobalOrientation()` walks to the root allocating nothing per-step but is itself O(depth) and called from `getGlobalOrientation()` which several other methods call transitively. Static scratch objects exist (`Transform.Matrix`, `Transform.Vector3`, `Transform.Quaternion`) but are used inconsistently — some call sites pass them, most don't, and because they're `static` singletons, two overlapping calls (e.g. `lookAt()` calling `getGlobalPosition(Transform.Vector3)` while something else mid-stack also borrowed `Transform.Vector3`) can clobber each other silently. This isn't an ECS-specific finding, but it's the most direct tax on "performance" of anything in scope — it's GC pressure multiplied by every actor, every frame.

### High — No change detection — every consumer re-reads every frame

There's no dirty flag, version counter, or epoch anywhere in the reviewed code. A system that only cares "did this actor's transform change since I last looked" (network sync, render dirty-flagging, spatial-index refresh — all named as motivating cases in ESEngine's own docs) has no primitive to ask that; it has to either re-check every frame or hand-roll its own last-seen-value comparison per consumer. ESEngine's epoch scheme (a global frame counter, a `lastWriteEpoch` per component, `forEachChanged(lastEpoch)`) is a small, generalizable primitive that turns "did this change" into an integer comparison instead of a value diff, and their own numbers (10% dirty → 10× less work, 1% dirty → 100×) are exactly the regime a voxel/pixel-art/network-heavy engine like this one lives in.

### Medium — No batch entity creation

`World.createActor()` and `new Actor(...)` are strictly one-at-a-time; each constructor call runs `world.sceneManager.registerActor()`, pushes into `#actorsByName`, etc. individually. Once a query/registry layer exists (finding above), this stops being free — every entity creation becomes N incremental cache updates instead of 1. ESEngine's `scene.createEntities(n)` exists specifically to amortize that. Worth designing for now even before the query layer lands, since retrofitting batch creation after call sites assume one-at-a-time is the harder direction.

### Medium — Hierarchy is mandatory, not opt-in

Every `Actor` carries `parent`, `children` (via `ActorTree`), and a full `THREE.Group`, whether or not it's ever reparented or has children. For an engine explicitly not aiming to be minimal or agnostic, this is a reasonable default — but it's worth naming because ESEngine deliberately keeps hierarchy out of its core `Entity` (a `HierarchyComponent` + `HierarchySystem` pair instead) specifically so "most entities don't pay for fields they don't use." If a future profiling pass shows actor-count scaling badly, this is the first structural reason why, and the fix (hierarchy-as-component) is a bigger migration the longer it waits.

### Medium — Type-erased escape hatches already exist and will fight a bitmask registry

`isPendingForDestruction()` in `Actor.ts` does `"pendingForDestruction" in component && (component as any).pendingForDestruction === true` — a structural check, not a type check, presumably because `Component` (the interface) doesn't declare that field but `ActorComponent` (the class) does. Small, but it's a symptom of the same root issue as the string `typeName`: component identity and shape aren't centrally registered anywhere, so code that needs to know "is this actually one of our components" falls back to duck-typing. A registry (finding above) fixes this for free as a side effect.

## 4. Storage model — what "flexible SoA/AoS" should actually mean here

The direct question in the brief: don't force one layout, but don't chase full-DOTS archetypes either.

Neither reference engine is a good 1:1 template for the storage layer specifically, for different reasons. ESEngine doesn't publish its internal component storage at all — its docs are explicit that entities and components are described at the API/algorithm level, not down to memory layout, so what's reusable from it is the *query* design (bitmask + incremental cache), not a storage pattern. bitECS goes the other direction and commits hard: every component *is* a set of parallel `TypedArray`s keyed by entity id, full SoA, no exceptions — which is exactly the "too simple" part flagged in the brief, because it assumes every entity's data is uniform, fixed-size, and numeric, which doesn't hold for a `Behavior` holding a `THREE.Vector3`, a loaded asset reference, or a nested config object.

The realistic target for this engine is **storage chosen per component type, not per engine**:

| Component shape | Right layout | Examples in this codebase |
|---|---|---|
| Heterogeneous, low-count-per-actor, DX-first | AoS — class instance, as today | `Behavior` subclasses, `Camera`, `ModelRenderer` |
| Homogeneous, numeric, bulk-processed, high count | SoA — typed-array-backed, opt-in | voxel/pixel-art gameplay data, particle state, anything the future physics/network sync layers touch in bulk |

Concretely, that means the component registry (Roadmap, Phase 1) shouldn't hardcode "components are class instances." It should register a *store* per component type — an `AoSStore<T>` (array of instances, indexed by entity slot) by default, with an opt-in `SoAStore` that a component type can request by declaring its fields as a schema instead of a class:

```typescript
// AoS — default, unchanged DX
class Health extends ActorComponent {
  current = 100;
  max = 100;
}

// SoA — opt-in for hot, bulk, numeric data
const Velocity = defineSoAComponent({
  x: Float32Array,
  y: Float32Array,
  z: Float32Array
});
// storage: three parallel Float32Arrays, indexed by entity slot —
// a system can iterate query.dense as a raw index range with zero
// per-entity object access
```

The query layer (Phase 2) has to be the thing that makes this transparent — `world.query(Health, Velocity)` returns matching entity slots regardless of which store backs each component; only the system body needs to know whether it's reading `component.current` or `Velocity.x[slot]`. That's the actual shape of "flexible enough to be either" — a per-type storage decision behind one query API, not a global switch.

## 5. Roadmap

Ordered so each phase is independently useful and doesn't require the next one to land. Nothing here requires breaking `addComponent`/`addComponentAndGet`'s public surface.

1. **Component registry + bitmask identity** — Replace `typeName: string` identity with a registry that assigns each component type a stable bit at registration time (mirrors ESEngine's `@ECSComponent`/`ComponentRegistry`). Actor gains a bitmask field, maintained alongside `components[]` — not instead of it, so `getComponent` keeps working unchanged. This is pure addition, no call-site changes, and it's the prerequisite for everything below.

2. **Query layer** — A `Matcher`-equivalent (`all`/`any`/`none`, compiled to bitmask ops against the Phase 1 registry) plus a query cache that updates incrementally on `addComponent`/component-destroy rather than re-scanning. This is the single highest-leverage change in this report — it's what turns ad hoc tree-walks into an actual ECS query, and it's the thing every later phase (SoA stores, change detection, systems-as-first-class) is built on top of.

3. **Structural-change safety** — Snapshot the iteration set per system tick (cheap: freeze the query's result array at tick start) and add a command-buffer option for deferred `addComponent`/destroy/reparent, flushed once after all systems run — closing the `needUpdate`-splice-during-iteration bug directly.

4. **Opt-in SoA component stores** — `defineSoAComponent(schema)` as described in §4, wired into the same query API as AoS components. Start with one real candidate — whichever of voxel-renderer or pixel-draw-renderer's bulk numeric state is currently the most GC-heavy — rather than converting speculatively.

5. **Epoch-based change detection** — Global frame counter + `lastWriteEpoch` stamping (works uniformly for both AoS and SoA stores — an SoA store just needs one epoch array parallel to its data arrays instead of one field per instance). Exposes `query.changedSince(epoch)`.

6. **Generational handles** — `ActorHandle {index, generation}` as an opt-in safe-reference type alongside the existing direct `Actor` reference — doesn't replace `actor.parent: Actor` (too invasive), but gives anything holding a reference across frame boundaries (save systems, network sync, async callbacks) a way to detect staleness instead of operating on a zombie actor.

## 6. What not to change

**The Three.js coupling.** Every actor owning a real `THREE.Object3D` is not an ECS mistake here — it's a deliberate choice for an editor-first engine where the scene graph *is* the authoring surface, and the brief is explicit that agnosticism isn't a goal. Don't chase bitECS's "entities are bare integers" purity; it would fight the editor.

**The AoS default for gameplay components.** `Behavior` subclasses as class instances is the right DX default for the 90% case — user-authored gameplay logic with a handful of typed fields. SoA should stay opt-in, requested by the component author, not the engine's only mode.

**`ActorTree`'s path-matching (`getActors("player/**")`).** Genuinely useful editor/debug tooling with no equivalent need in either reference engine. Keep it independent of whatever the query layer becomes.

## 7. Sources

- ESEngine docs — [esengine.cn/en/guide](https://esengine.cn/en/guide/) (Entity, Component, Entity Query, System, Scene, Hierarchy, Persistent Entity, and Event System pages, read directly this session)
- bitECS docs — [bitecs.dev/docs/introduction](https://bitecs.dev/docs/introduction)
- This repository — `packages/engine/src/{actor,systems,components}`
