# @jolly-pixel/ecs - Specification

The design contract for a from-zero Entity Component System. This document
states *what* is being built and *why* each decision was taken.
[PLAN.md](./PLAN.md) states *in what order*.

- **Status** - research spike. Private package, no npm publish, no consumer
  migration in scope.
- **Long-term intent** - a credible successor to `@jolly-pixel/engine`'s
  Actor/ActorComponent core. The spike must *prove* that path is viable, not
  take it.
- **Goal** - the best of three designs, not one of them: the current engine's
  developer experience, ESEngine's API and query design, and bitECS's data
  layout. A fast core that nobody enjoys using has failed the brief exactly as
  much as a pleasant one that is slow.
- **Inputs** - the `ECS_AUDIT.md` findings against `packages/engine`, the
  ESEngine architecture report, and bitECS.

## Contents

1. [Non-goals](#1-non-goals)
2. [Two tiers](#2-two-tiers)
3. [Naming](#3-naming)
4. [Entity model](#4-entity-model)
5. [Component model](#5-component-model)
6. [Storage internals](#6-storage-internals)
7. [Query model](#7-query-model)
8. [System model and scheduling](#8-system-model-and-scheduling)
9. [Structural-change safety](#9-structural-change-safety)
10. [Change detection](#10-change-detection)
11. [Hierarchy](#11-hierarchy)
12. [Transforms](#12-transforms)
13. [Scenes](#13-scenes)
14. [The DX tier](#14-the-dx-tier)
15. [The additive invariant](#15-the-additive-invariant)
16. [Serialization](#16-serialization)
17. [Three.js binding](#17-threejs-binding)
18. [Invariants](#18-invariants)
19. [Known hazards](#19-known-hazards)

## 1. Non-goals

Written here so they do not creep in. None of the following ship in this
package:

| Excluded | Why |
|---|---|
| Event bus | `@openally/emitt` already used repo-wide |
| Asset loading, IO of any kind | `@jolly-pixel/asset` owns this; the core inverts it behind an interface (section 13) |
| Entity relations (flecs-style typed links) | Large, and hierarchy covers the concrete need |
| Worker / multithreaded systems | Sub-project on its own; needs SharedArrayBuffer design |
| Networking, replication | `@jolly-pixel/network` owns this |
| Plugin system, service container | Framework concerns, not ECS concerns |
| A frame loop | `FixedTimeStep` exists in `packages/engine` |

Scene management **is** in scope, unlike most ECS libraries. See
[Scenes](#13-scenes) for where the line is drawn between what the core owns
(anything deciding when entities exist) and what it does not (anything
touching IO). Prefabs come with it, because a prefab turns out to be a scene
snapshot rather than a separate mechanism.

The core is Three-free. It runs headless under `node:test`, which is what
makes every benchmark measure ECS cost rather than WebGPU or DOM cost. The
only candidate runtime dependency is `picomatch`, for path matching (see
[Hierarchy](#11-hierarchy)); it is inlined if the glob subset in use is small
enough.

## 2. Two tiers

The audit's diagnosis of the current engine was not "it is slow." It was that
there is exactly one storage shape and one iteration path, and **no escape
hatch**. The symmetric failure would be to build a fast core with no
*ergonomic* hatch. So this package ships two public tiers over one world.

| Tier | Surface | Who uses it |
|---|---|---|
| **DX tier** | `Entity`, `Component`, `Script`, `Transform`, `HierarchySystem` | the default, what the README teaches, roughly 90% of code |
| **Core tier** | `EntityId`, `defineComponent`, `Matcher`, `System` | the documented escape hatch for the hot 10% |

They are not alternatives and they are not layered products. They are two
views of the same world, and they interoperate at zero cost: a `System` can
grind 100k entities in a tight typed-array loop while a `Script` on one of
those entities calls `entity.getComponent(...)` in the ordinary way.

The rule that keeps this honest is in [section 15](#15-the-additive-invariant):
the DX tier may be slower than the core tier, but it may never make the core
tier slower for someone who declined it.

## 3. Naming

Names carry over from `@jolly-pixel/engine` wherever the concept is the same.
Where they do not, it is deliberate and recorded here.

| Concept | Engine today | Here | Note |
|---|---|---|---|
| World | `World` | `World` | |
| Entity | `Actor` | `Entity` + `EntityId` | renamed to the standard term so the two can coexist unambiguously during any migration |
| Creation | `world.createActor(name)` | `world.createEntity(name)`, `world.createEntities(n)` | batch form from ESEngine |
| Component base | `ActorComponent` | `Component` | data-only, see section 5 |
| Scripting | `Behavior` | `Script` | renamed to mark that it holds logic, unlike `Component`. Matches today's `typeName: "ScriptBehavior"` |
| Access | `addComponent`, `addComponentAndGet`, `getComponent`, `getComponents` | unchanged | |
| Lifecycle | `awake`, `start`, `update`, `fixedUpdate`, `destroy` | unchanged, on `Script` | |
| Staleness | `isDestroyed()` | `isDestroyed()` | now actually reliable, see section 4 |
| Hierarchy | `ActorTree`, `Actor.parent` | `HierarchyComponent`, `HierarchySystem` | ESEngine's vocabulary and method set |
| Path matching | `tree.getActors("player/**")` | `hierarchy.findByPath("player/**")` | kept; the audit says to |
| Transform | `Transform` | `Transform` | now SoA-backed |
| Signals | `SignalEvent` | `SignalEvent` | |
| Scene | `Scene` | `Scene` + `SceneId` | same split as `Entity`/`EntityId` |
| Scene container | `SceneManager` | `World` | a world holds many concurrent scenes; no separate manager |
| Scene loading | `SceneLoad`, `SceneLoader`, `SceneLoadDriver` | unchanged | asset types genericized, see section 13 |
| Logic unit | *(none)* | `System` | |
| Query | *(none)* | `Matcher`, `Query` | |

Both storage kinds keep the word "component". They are the same concept to a
query; only authoring and access differ, and the factory name already says
which is which.

## 4. Entity model

An `EntityId` **is** a plain `number`, a branded numeric type. There is no
per-entity object allocation anywhere in the core.

The number packs two fields:

```
 31                    20 19              0
+------------------------+-----------------+
|       generation       |      index      |
+------------------------+-----------------+
```

Defaults are 20 index bits (1,048,575 live entities) and 12 generation bits
(4096 recycles per slot before wraparound). The split is process-global and
set once:

```typescript
configureEntityLayout({ indexBits: 24, generationBits: 8 });
```

It throws if called after any `World` exists. Process-global rather than
per-world so that `entityIndex()` stays a branch-free constant-mask operation
in the hot path.

### Why packed rather than a separate handle

ESEngine keeps a raw `id` for speed and bolts an `EntityHandle {index,
generation}` object on the side for staleness checking. That makes safety
opt-in, which is exactly the failure mode `ECS_AUDIT.md` records against
`Actor` today ("a held reference never goes stale-safe"). Packing the
generation into the id makes every held reference checkable for the cost of
one integer compare, with no second entity concept in any signature.

### Operations

| API | Cost | Notes |
|---|---|---|
| `world.createEntity(name?)` | O(1) | returns a materialized `Entity`, see section 14 |
| `world.spawn()` | O(1) | returns a bare `EntityId`, materializes nothing |
| `world.createEntities(n)` | O(n) amortized | one capacity growth, one cache pass |
| `world.destroy(id)` | O(components) | bumps the slot generation, pushes the index |
| `world.exists(id)` | O(1) | `generations[entityIndex(id)] === entityGeneration(id)` |
| `entityIndex(id)` | O(1) | `id & INDEX_MASK`, exported free function |

`destroy()` is idempotent: destroying an already-dead entity is a no-op, not
an error. Two systems in one frame frequently decide the same entity should
die.

Generation wraparound is a real limit, not a theoretical one. On wrap the
counter returns to 0 and a very old id can alias. The debug build counts wraps
and warns; the release build does not check.

## 5. Component model

Three factories plus one class base, all over one internal store interface.
Storage is chosen per component type, never globally. Every component type
gets a registry bit regardless of which store backs it, so membership testing
is uniform.

**Components hold data. They do not hold logic.** No lifecycle hooks beyond
attach and detach, no reading of sibling components, no per-frame `update`.
That work belongs to a `System`. The single sanctioned exception is `Script`
(section 14), which exists precisely so the rule can hold everywhere else.

### `defineComponent` - SoA

Numeric, fixed-shape, bulk-processed data. Backed by parallel typed arrays
indexed by entity index.

```typescript
const Position = defineComponent("Position", {
  x: f32,
  y: f32,
  z: f32
});

const idx = entityIndex(id);
Position.x[idx] = 4;
```

Field types: `i8`, `u8`, `i16`, `u16`, `i32`, `u32`, `f32`, `f64`, `bool`
(stored as `u8`), `eid` (stored as `u32`, see
[Serialization](#16-serialization)), and fixed-size arrays declared as
`[f32, 3]`.

### `defineTag` - zero storage

```typescript
const Frozen = defineTag("Frozen");
```

A registry bit and nothing else. No column, no allocation.

### `defineObject` - AoS

Heterogeneous, non-numeric, or externally-owned data: `THREE.Object3D`, asset
references, closures, strings, nested config.

```typescript
const Mesh = defineObject<THREE.Object3D>("Mesh", { transient: true });
```

Backed by a sparse `Array<T>` indexed by entity index. An object component
must declare either `serialize`/`deserialize` or `transient: true`; the
registry throws otherwise, so no component can silently fail to round-trip.

### `Component` - the class form

The DX-tier authoring style, carried over from today's `ActorComponent`:

```typescript
class Health extends Component {
  static typeName = "Health";

  current = 100;
  max = 100;
}
```

Subclassing registers an object store whose registry name is `typeName`.
Instances are reached through the DX tier (`entity.getComponent(Health)`) or
directly from a system through the store. This is a `defineObject` with a
class-shaped authoring surface, not a fourth storage kind.

### Registry

Every component type requires a unique string name. The name is the
serialization key and survives minification; a collision throws at definition
time. The registry assigns bits in definition order and derives the
per-entity bitset word count from the total.

### Mutation API

Structural operations live on the world, because the world owns the bitset,
the query caches, and the command buffer:

```typescript
world.add(id, Position, { x: 1, y: 2, z: 0 });
world.remove(id, Position);
world.has(id, Position);
```

The DX tier's `entity.addComponent(...)` forwards to exactly these.

## 6. Storage internals

Three data structures, each doing one job.

**Per-entity bitset.** One flat `Uint32Array` of `capacity * wordCount`.
`has` is `(words[idx * wordCount + word] & bit) !== 0`. This replaces the
current engine's string `typeName` comparison and `instanceof` fallthrough,
which `ECS_AUDIT.md` flags as Critical.

**Per-component sparse set.** A dense `Uint32Array` of owning entity indices
plus a sparse index array. O(1) add, O(1) swap-remove, cheap iteration of
"everyone who has this component" without scanning the world.

**Per-query dense set.** Each registered query owns its own sparse set,
maintained incrementally. Queries are indexed by component bit, so a
structural change walks only the queries that mention the affected bit.

Nothing moves on add or remove. This is deliberately not an archetype or
chunk design: archetypes buy better iteration locality but pay data movement
on every structural change and a large amount of graph-management complexity.
That trade is worth benchmarking later, not assuming now.

### Growth

Columns grow by allocating a larger typed array and copying. **A column
reference is only valid until the next structural change.** Caching
`const x = Position.x` across an `add` is a use-after-free class of bug. See
[Known hazards](#19-known-hazards).

## 7. Query model

Two pieces, following ESEngine: an immutable declarative `Matcher`, and an
execution and caching layer that keeps results live.

```typescript
const movers = Matcher.empty()
  .all(Position, Velocity)
  .any(Player, Npc)
  .none(Frozen, Dead);
```

Every chained call returns a new `Matcher`; `matcher.any(X) !== matcher`.
`Matcher.empty()` matches every live entity and starts a chain;
`Matcher.nothing()` matches nothing, for systems that only want lifecycle
hooks.

A matcher compiles once into three word arrays (`allMask`, `anyMask`,
`noneMask`) evaluated against the entity bitset with AND / OR / AND-NOT.

```typescript
const query = world.query(movers);

query.count;    // number
query.dense;    // Uint32Array of entity indices, length >= count
for (const id of query) { /* ... */ }
```

`world.query(matcher)` is memoized by compiled mask, so two systems asking
for the same shape share one cache.

### Iteration order

Unspecified by default. Removal is swap-remove, so order changes as entities
come and go. Tests and consumers must not depend on it.

`world.query(matcher, { sorted: true })` lazily re-sorts the dense array
before iteration when dirty, giving monotonically increasing indices and
therefore near-sequential SoA column access. Which default is right is a
benchmark question (PLAN.md, P5), not an assumption.

## 8. System model and scheduling

One `System` base class. ESEngine's five subclasses collapse into options on
that one class, because the five differ only in *when* they run, not in what
they are.

```typescript
class MoveSystem extends System {
  static matcher = Matcher.empty().all(Position, Velocity);
  static stage = "update";
  static after = [InputSystem];

  process(
    entities: Uint32Array,
    count: number,
    dt: number
  ) {
    const px = Position.x;
    const vx = Velocity.x;

    for (let i = 0; i < count; i++) {
      const idx = entities[i];
      px[idx] += vx[idx] * dt;
    }
  }
}
```

Ordering is declared with plain statics, not decorators: decorators require
`reflect-metadata`, which the core cannot take, and are not erasable syntax.

| Option | Effect | ESEngine equivalent |
|---|---|---|
| `static matcher` omitted | `process` runs once per frame with no entity set | `ProcessingSystem` |
| `static interval = 5000` | `process` gated to a fixed interval in ms | `IntervalSystem` |
| only `onAdded` / `onRemoved` defined | reactive, no per-frame loop | `PassiveSystem` |
| default | per-frame batch over the matched set | `EntitySystem` |

`WorkerEntitySystem` has no equivalent and is an explicit non-goal.

### Per-frame order

`onBegin` then `process` then `lateProcess` then `onEnd`. `onInitialize` runs
once on registration, `onDestroy` once on removal. `onCheckProcessing()`
returning `false` skips the frame cheaply, for a pause state, without
unregistering.

`process` receives the whole dense array and its count. It does **not**
receive one entity per call: a per-entity callback would put a function call
in the innermost loop, which is precisely the overhead this package exists to
remove. The DX tier offers a per-entity form on top, with its cost published
(section 14).

### Scheduler

Five fixed stages: `startup`, `preUpdate`, `update` (default), `postUpdate`,
`cleanup`. Within a stage, systems are topologically sorted once from
`static before` and `static after`, with `static order` as a tiebreak and
registration order below that. A cycle throws at resolve time rather than
resolving to an arbitrary order.

The core owns no frame loop. `world.systems.run(dt)` is called by whoever
owns the loop.

## 9. Structural-change safety

`ECS_AUDIT.md` records the concrete bug this closes: `ActorComponent`'s
`needUpdate` setter splices `componentsRequiringUpdate` while `Actor.update`
iterates it with `forEach`, silently skipping components. In this design
there is no such array: "who needs updating" is a query.

Two mechanisms, at two granularities.

**Iteration lock (within one `process` call).** While a query's dense array
is being iterated the query is locked. Any structural change that would touch
a locked query is transparently routed into the frame's command buffer
instead of mutating live. The change lands on the next flush.

ESEngine instead copies the dense array before each `process`. That is
simpler but allocates once per system per frame, proportional to entity
count; on a 1M-entity query that is a 4MB copy per system per frame, which
would dominate this package's own benchmarks. The lock achieves the same
guarantee with zero copies.

**Command buffer (across a stage).** `addComponent`, `removeComponent`,
`destroy`, and `setEnabled` queue in FIFO order and flush once at the stage
boundary. Commands targeting an already-destroyed entity are skipped. Beyond
safety this batches query-cache churn, which is ESEngine's own stated second
reason for having it.

Outside system execution (scene setup, tests, editor commands) mutations
apply immediately. "Create an entity and read it back" has to work.

## 10. Change detection

Opt-in per component type:

```typescript
const Position = defineComponent("Position", { x: f32, y: f32 }, {
  track: true
});
```

`track: true` allocates one parallel `Uint32Array` epoch column. Untracked
components allocate nothing.

The tension specific to SoA: `Position.x[idx] = 5` is a raw typed-array write
and cannot stamp anything without a proxy, and a proxy would erase the reason
for having SoA. So stamping is explicit:

```typescript
Position.x[idx] = 5;
Position.touch(idx);

// or, stamping included
Position.write(id, { x: 5 });
```

The world holds a global epoch counter incremented once per `systems.run`.
Consumers ask integer questions rather than diffing values:

```typescript
query.changedSince(lastEpoch);
Position.hasChanged(idx, since);
```

Systems carry an auto-advancing checkpoint, so "iterate what changed since I
last looked" does not require the caller to track epochs by hand.

Forgetting to `touch` is the obvious failure mode. The debug build shadow
copies tracked columns after each stage and asserts that every value change
was stamped, so the mistake surfaces in the test suite rather than as a stale
network packet.

## 11. Hierarchy

Optional, and built as a component plus a system, following ESEngine's design
and vocabulary. The reason is stated plainly there: most entities have no
parent and no children, so most entities should not pay for the fields.
`ECS_AUDIT.md` records the opposite situation in the current engine, where
every `Actor` carries `parent`, `children`, and a `THREE.Group`
unconditionally.

`HierarchyComponent` is SoA columns, not per-entity arrays:

| Column | Meaning |
|---|---|
| `parent` | `eid` of the parent, or 0 |
| `firstChild` | `eid` of the first child, or 0 |
| `nextSibling` | `eid` of the next sibling, or 0 |
| `depth` | `u8`, capped at 32 |

A linked-list representation rather than a child array means reparenting
allocates nothing and a node costs four scalars regardless of child count.

`HierarchySystem` owns all logic, with ESEngine's method set: `setParent`,
`insertChildAt`, `removeChild`, `removeAllChildren`, `getParent`,
`getChildren`, `getRoot`, `getRootEntities`, `isAncestorOf`,
`isDescendantOf`, `getDepth`, `findChild`, `forEachChild`. `setParent`
rejects cycles and rejects exceeding the depth cap (32, matching ESEngine,
which bounds traversal cost on pathological trees).

### Path matching

One addition to ESEngine's set, carried over from `ActorTree.getActors`:

```typescript
hierarchy.findByPath("player/**");
```

The audit explicitly says to keep this ("genuinely useful editor/debug
tooling with no equivalent need in either reference engine") and to keep it
independent of the query layer. It is name-based editor tooling, not a
component query, and it must never be reachable through `Matcher`: a glob
scan inside a bitmask evaluator would defeat the point of both.

## 12. Transforms

Optional, SoA, and in the core rather than in the Three binding. The reason
is that `ECS_AUDIT.md` flags per-call allocation in `Transform` as the single
largest direct performance tax in the current engine (`lookAt()` allocating a
`Matrix4` and two `Vector3` per call; static scratch objects that two
overlapping calls can clobber). Reproducing that measurably better, headless,
is the most persuasive result this spike can produce.

- `LocalTransform` - `position` `[f32, 3]`, `rotation` `[f32, 4]`,
  `scale` `[f32, 3]`, `track: true`.
- `WorldTransform` - `matrix` `[f32, 16]`, written by propagation only.

`TransformPropagationSystem` walks dirty subtrees, using the epoch column to
find roots of change, and writes into preallocated matrix columns. No
allocation in steady state, and no work at all for a subtree whose local
transforms did not change.

The DX tier's `Transform` (section 14) is a facade over these columns,
preserving today's method names.

## 13. Scenes

Most ECS libraries either ignore scenes or model them badly, and the current
engine's `SceneManager` is 660 lines of genuinely load-bearing machinery. So
this is in scope, with a line drawn deliberately.

**The model is World > Scenes > Entities.** One world holds many concurrent
scenes. A scene is a lifecycle and ownership unit, not a separate world: all
scenes share one set of stores, one bitset, and one set of query caches, so
cross-scene queries are ordinary queries and additive scenes cost nothing
structural.

This is where the design departs from ESEngine, where a `Scene` *is* a World
and multiple worlds are managed above it. That model makes additive scenes
into disjoint worlds that cannot share a query or a system, which the editor
packages here rely on doing.

### What is in the core, and what is not

The split rule: **anything that decides when entities exist belongs to the
package that owns entities; anything that touches IO does not.**

| In core | Not in core |
|---|---|
| `SceneId` partition, ownership assignment | asset resolution and loading |
| bulk `destroyScene` | `AssetReference`, `AssetCoordinator` |
| scene-scoped queries | the Three scene graph |
| the load state machine and its activation timing | the actual loader implementation |
| prefab instantiation | loading screens and progress UI |

### Partition

Every entity carries its owning scene as a `u16` column. Creating an entity
inside a scene's `awake()` assigns that scene's id from creation context,
which is what replaces the current engine's manual `ownedActors: Set<Actor>`
bookkeeping. Ownership is a column read, not a set membership test.

```typescript
const scene = world.createScene("Level1");

world.destroyScene(scene.id);   // O(scene size), one dense walk
Matcher.empty().all(Position).inScene(scene.id);
```

`destroyScene` walks the scene's dense set and destroys, rather than scanning
the world. Removing an additive scene stops being "diff what `awake()`
created and cascade from the roots" and becomes a partition drop.

### Persistence and tombstones

An entity marked with the `Persistent` tag is skipped by `destroyScene` and
keeps its original `sceneId`, so provenance survives: you can always ask
which scene an entity came from, including after that scene is gone.

`SceneId` is therefore **monotonic and never recycled**. A destroyed id
becomes a tombstone:

- `world.getScene(id)` returns `null`.
- A scene-scoped query on a dead id matches nothing.
- The entity stays fully alive and reachable through ordinary component
  queries.
- `entity.isOrphaned()` reports the condition explicitly.

The cost is a `u16` id space that shrinks over a long session, so the scene
id width is configurable alongside the entity layout (section 4).

### Load state machine

Ported from the current engine essentially unchanged, because its inversion
is already correct. The two asset types are genericized to a structural
progress shape so the core stays dependency-free and headless-testable:

```typescript
interface SceneLoadDriver {
  readonly load: SceneLoad;

  start(completed: number, total: number): void;
  report(progress: { completed: number; total: number; detail?: unknown; }): void;
  ready(): void;
  fail(error: Error): void;
}

interface SceneLoader {
  load(driver: SceneLoadDriver): void;
}
```

States are `requested`, `loading`, `ready`, `active`, with `failed` and
`cancelled` terminal, plus `activationAllowed` so `activation: "manual"`
holds a ready scene until something releases it. `RuntimeSceneLoader` and
`AssetCoordinator` stay exactly where they are and implement the interface
unchanged.

The core owns this rather than the runtime because the state machine decides
*when entities appear and disappear*, which is a storage and query concern.
The loading is not.

### Activation timing

Activation is a **command**, not a second deferral mechanism. It queues on
the command buffer and applies at the `startup` stage boundary, the same way
`addComponent` does.

That unification removes three hand-maintained arrays from the current
design:

| Today | Here |
|---|---|
| `componentsToBeStarted: Component[]` | a `NotStarted` tag, drained by a built-in system in `startup` |
| `componentsToBeDestroyed: Component[]` | a `PendingDestroy` tag, drained in `cleanup` |
| `#cachedActors` snapshot per frame | nothing; the query cache already is the live set |

It also removes a hack. `SceneManager.beginFrame` currently walks
`componentsToBeStarted` and *skips components whose actor is not yet
registered*, retrying them next frame. Here the start query is scene-scoped,
so a component in a not-yet-active scene simply does not match, and there is
nothing to skip or retry.

### Prefabs

A prefab is a scene snapshot. Instantiating one is restoring that snapshot
into a live world under a new scene id, which is the `eid` remapping
machinery from [Serialization](#16-serialization) doing exactly what it
already does:

```typescript
const prefab = world.snapshotScene(templateId);
const spawned = world.instantiate(prefab, { scene: levelId });
```

One mechanism serves save and load, additive scene loading, and prefab
instantiation. This is the reason serialization is built early (PLAN.md, P4):
three features depend on that remapper, not one.

## 14. The DX tier

The core tier is what makes the engine fast. This tier is what makes it worth
using. Every piece here is a deliberate trade of some performance for
ergonomics or maintainability, and every piece has its price measured and
published (section 15).

### `Entity`

`Entity` is a small class holding `(world, id)`. The world interns at most one
instance per id and creates it lazily.

```typescript
const player = world.createEntity("Player");   // materialized immediately
const id = world.spawn();                       // bare EntityId, no object
const entity = world.entity(id);                // promote when you want methods
```

`world.entity(id)` always returns the same instance for the same id, so `===`
comparisons and `Map<Entity, T>` keys behave the way today's code expects.
Because it holds the packed id, a stale `Entity` fails `isDestroyed()` rather
than operating on a recycled slot, which closes the audit's High finding.

The cost model is the point: `createEntity` behaves exactly like today's
`createActor`, while a system spawning a million particles through `spawn()`
materializes nothing and pays zero bytes. The DX tier is opt-in **per
entity**, not per world.

Methods carry over unchanged: `addComponent`, `addComponentAndGet`,
`getComponent`, `getComponents`, `destroy`, `isDestroyed`, `setParent`.

### `Component`

Data-only class-based components, as in section 5. The authoring experience
matches today's `ActorComponent` minus the lifecycle hooks.

### `Script`

The one sanctioned home for logic in a component-shaped object, and the
reason `Component` can stay strictly data-only. It replaces today's
`Behavior`, keeping its full lifecycle:

```typescript
class PlayerController extends Script {
  @SceneProperty({ type: "number" })
  speed = 5;

  awake() {}
  start() {}
  update(deltaTime: number) {}
  fixedUpdate(deltaTime: number) {}
  destroy() {}
}
```

Scripts are stored in an object store and driven by one built-in
`ScriptSystem` that batches over that store. There is no per-entity array of
"things needing update" anywhere; the set is a query, which is what removes
the audit's Critical mutation bug by construction rather than by fixing it.

The rename from `Behavior` marks the distinction that matters: `Component` is
data, `Script` is logic. It also lines up with today's
`typeName: "ScriptBehavior"`.

The editor decorators (`@SceneProperty`, `@SceneActorComponent`,
`@InputListener`) attach to `Script`, not to `Component`, and live in the DX
tier so the core stays free of `reflect-metadata`.

### `Scene`

The lifecycle object, carried over from today's engine essentially unchanged:

```typescript
class Level1 extends Scene {
  constructor() {
    super("Level1", { assets: [heroModel, levelMusic] });
  }

  awake() {}
  start() {}
  update(deltaTime: number) {}
  fixedUpdate(deltaTime: number) {}
  destroy() {}
}
```

It binds to a core `SceneId` and owns the two things the core deliberately
does not: declared `assets` (so knowing about `AssetReference` stays in the
DX tier) and the lifecycle hooks. Entities created during `awake()` inherit
this scene's id from creation context, which is what replaces the engine's
manual `ownedActors` set.

### `Transform`

A facade over the `LocalTransform` and `WorldTransform` columns, preserving
today's method names and semantics while fixing the allocation behaviour
underneath. Scratch objects are per-instance rather than `static`, which
removes the clobbering hazard the audit describes.

### Per-entity iteration

For readability the DX tier offers a per-entity callback form over a query.
It is strictly slower than the batch `process` and is documented as such,
with the measured ratio published beside it. Offering it is the trade;
hiding its cost would not be.

## 15. The additive invariant

The rule that makes "sometimes we trade performance for DX" safe rather than
corrosive:

> **No DX-tier abstraction may make the core path slower for someone who is
> not using it.**

An abstraction may be slower *itself*. It may not charge its cost to people
who declined it. Concretely, that forbids virtual hooks inside SoA loops, and
forbids bookkeeping in `world.add` that exists only for the `Entity` wrapper.

Enforcement is mechanical, not cultural:

- A benchmark runs the core path with the DX tier loaded and with it absent,
  and asserts no measurable delta.
- Every DX abstraction (`Entity` promotion, `getComponent`, `Script`
  dispatch, `findByPath`, per-entity iteration) has a paired benchmark
  against its raw equivalent.
- The measured ratio is published in the API documentation beside the
  abstraction it describes.

The rule is not "abstractions must be fast". It is "abstractions must be
honest about their price, and must not charge it to people who declined".

## 16. Serialization

Designed in from the first component definition, because it is the hardest
thing to retrofit into a storage layer. Implemented at P4, ahead of queries.

```typescript
const snapshot = world.snapshot();      // format-agnostic intermediate
const json = encodeJSON(snapshot);      // editor, debugging, golden files
const bytes = encodeBinary(snapshot);   // typed-array native

const restored = World.restore(decodeJSON(json));
```

The intermediate carries, per component: its registry name, the dense list of
owning entity indices, and the column slices. No format is baked into the
world.

### Entity references

Packed ids embed a generation and come from a recycled free list, so they are
**not** stable across a save and load. Two mechanisms handle this:

- The `eid` field type marks a column as holding entity references.
- On restore, entities are compacted into a dense range and every `eid`
  column is rewritten through the remap table.

So a saved `HierarchyComponent.parent` resolves correctly even though every
raw id changed. Without a declared `eid` type this is impossible to do
automatically, which is why it is a first-class field type rather than a
convention.

### Object components

Non-numeric data cannot be encoded generically. Every `defineObject` and
every `Component` subclass must supply `serialize`/`deserialize` or set
`transient: true`. Transient components are skipped on snapshot and absent
after restore, and the restore result reports which ones were dropped.

`Script` instances are transient by default: logic is code, not state. A
script that owns state declares it explicitly.

### Compatibility

The snapshot carries a format version and the registry names present at save
time. Restoring a snapshot containing an unregistered component name is an
error by default, overridable with an explicit `onUnknownComponent` policy.
Schema migration is a non-goal.

## 17. Three.js binding

Proof of concept only, built last, under `src/three/` with its own export
path. Three stays a **pure sink**:

- `Object3DRef` - a `defineObject<THREE.Object3D>` with `transient: true`.
- `ThreeSyncSystem` - for entities with both `WorldTransform` and
  `Object3DRef`, copies the world matrix into the Object3D with
  `matrixAutoUpdate = false`.

Three never owns hierarchy or transforms in this design. The ECS is
authoritative; the scene graph mirrors it. This is the single most important
thing the spike has to validate, because it is where a future engine
replacement either works or does not.

## 18. Invariants

Asserted by `world.__checkInvariants()` in the debug build and after every
operation in the differential fuzz harness:

1. For every store: `sparse[dense[i]] === i` and `dense[sparse[e]] === e`.
2. The registry bit for a component is set in the entity bitset **iff** that
   component's store holds the entity.
3. Every query's membership equals its matcher evaluated over all live
   entities, recomputed from scratch.
4. No destroyed entity appears in any store, any query, or the bitset.
5. No index in the free list is live; no live index is in the free list.
6. Slot generations are non-decreasing except on documented wraparound.
7. The command buffer is empty outside a flush.
8. Every column length is at least the world capacity.
9. `snapshot` then `encode` then `decode` then `restore` then `snapshot` is a
   fixed point.
10. At most one `Entity` instance is interned per live id, and none is
    interned for a dead one.
11. Every live entity's `sceneId` is either a live scene or a tombstone; it is
    never an id that was never issued.
12. After `destroyScene(id)`, no live entity carries `sceneId === id` except
    those tagged `Persistent`.
13. Scene ids are strictly monotonic and never reissued.
14. A scene in the `active` state has no entity left carrying `NotStarted`
    after the `startup` stage completes.

## 19. Known hazards

Recorded up front so they are tested rather than discovered.

**Stale column references.** `const x = Position.x` is invalid across any
structural change, because growth reallocates. Documented loudly, and the
debug build detects it by generation-stamping columns.

**Unstamped writes.** Raw SoA writes without `touch` silently break change
detection. Mitigated by the debug shadow-copy assertion (section 10).

**Generation wraparound.** 4096 recycles per slot at the default layout.
Counted and warned in debug.

**Entity cap.** 1,048,575 live entities at the default layout. Exceeding it
throws rather than silently corrupting the index field.

**Incremental cache invalidation.** The highest-risk correctness area in the
whole package, and the reason the differential fuzz harness (PLAN.md, P0) is
built before the cache exists rather than after.

**Interning leak.** The `Entity` intern table must release on destroy, or a
long-running world accumulates wrappers for dead ids. Covered by invariant 10
and by a dedicated churn test.

**Scene id exhaustion.** Ids are monotonic and never reused, so a `u16` width
allows 65,535 scene creations per world lifetime. Ample for a game, plausibly
not for an editor session that instantiates prefabs as scenes in a loop. The
width is configurable, and the debug build warns past 75 percent.

**Orphaned entities.** A `Persistent` entity outlives its scene and keeps a
tombstoned `sceneId`. This is deliberate (it preserves provenance) but it
means scene-scoped queries silently return nothing for it. `isOrphaned()`
exists so the condition is askable rather than surprising.

**Transition ordering.** Activation, `NotStarted` draining, and command-buffer
flushing all land at stage boundaries, so their relative order is a
correctness property rather than an implementation detail. It is pinned by
invariant 14 and by explicit ordering tests, not left to whatever the
scheduler happens to do.

**Data-only erosion.** Nothing in the type system prevents someone adding an
`update()` to a `Component`. The rule is enforced by documentation, by
`Script` existing as the obvious alternative, and by a lint rule if erosion
shows up in practice.

**Benchmark noise.** Timings on a Windows dev machine vary enough to hide
10 percent regressions. Methodology is min-of-3 against a committed baseline
with a correctness checksum asserted before any timing is reported.
