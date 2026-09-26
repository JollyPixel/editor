# @jolly-pixel/ecs - Implementation plan

Step-by-step build order for the design in [SPEC.md](./SPEC.md). Twelve
phases. Each phase names its deliverables, its tests, its benchmarks, and the
condition under which it is considered done.

Three rules hold across every phase:

- **Tests and benchmarks land with the code, never after it.** A phase is not
  done when the implementation works; it is done when the suite proves it
  works and the bench records what it costs.
- **The differential fuzz harness exists before the thing it will find bugs
  in.** It is built in P0, against an empty core, and every later phase
  extends its operation vocabulary.
- **The DX tier is not a finishing touch.** A vertical slice of it lands at
  P3, before serialization and before queries, so that the core is shaped by
  the API people will actually use rather than the other way round.

## Contents

1. [Phase overview](#1-phase-overview)
2. [P0 - Scaffold, harness, reference model](#p0---scaffold-harness-reference-model)
3. [P1 - Entity core](#p1---entity-core)
4. [P2 - Registry and stores](#p2---registry-and-stores)
5. [P3 - DX vertical slice](#p3---dx-vertical-slice)
6. [P4 - Serialization](#p4---serialization)
7. [P5 - Queries](#p5---queries)
8. [P6 - Systems, scheduler, command buffer](#p6---systems-scheduler-command-buffer)
9. [P7 - Scenes](#p7---scenes)
10. [P8 - Change detection](#p8---change-detection)
11. [P9 - Hierarchy and transforms](#p9---hierarchy-and-transforms)
12. [P10 - The DX tier](#p10---the-dx-tier)
13. [P11 - Three binding and report](#p11---three-binding-and-report)
14. [Testing strategy](#14-testing-strategy)
15. [Benchmark methodology](#15-benchmark-methodology)
16. [Risk register](#16-risk-register)
17. [Open questions](#17-open-questions)

## 1. Phase overview

| Phase | Delivers | Tier |
|---|---|---|
| P0 | package scaffold, test and bench harness, naive reference model, fuzz harness | - |
| P1 | packed `EntityId`, free list, generations | core |
| P2 | registry, bitsets, the three stores, reserved `sceneId` column | core |
| P3 | `Entity` wrapper, `Component` base, `addComponent`/`getComponent` | DX |
| P4 | snapshot, JSON and binary encoders, `eid` remapping | core |
| P5 | `Matcher`, incremental query cache, iteration lock, first full benchmark run | core |
| P6 | `System`, scheduler, command buffer | core |
| P7 | `SceneId` partition, load state machine, lifecycle unification, prefabs | core |
| P8 | epoch columns, `changedSince` | core |
| P9 | `HierarchyComponent`, `HierarchySystem`, SoA transform propagation | core |
| P10 | `Script` + `ScriptSystem`, `Scene` class, `Transform` facade, decorators, abstraction-tax suite | DX |
| P11 | Three binding, example, benchmark report, retrospective | - |

Three orderings in that table are deliberate and worth stating.

**Serialization at P4, ahead of queries.** Putting it there forces the
storage layer to be encoder-friendly under real pressure rather than by
intention, and the snapshot layer then walks stores directly with no query
dependency. It also lands the `eid` remapper early, which three later
features depend on: save/load, additive scene loading, and prefab
instantiation.

**Scenes at P7, immediately after the command buffer.** Scene activation is a
command and the lifecycle drains are tag-driven systems, so scenes cannot
land before P6. They land immediately after because everything from P8 onward
is easier to test inside a real scene than outside one.

**The DX tier split across P3 and P10.** P3 is the vertical slice whose job is
to shape the core while the core is still soft. P10 is the rest, and it lands
where it does because `Script` needs Systems (P6), `Scene` needs the partition
(P7), the `Transform` facade needs transforms (P9), and the abstraction-tax
bench suite is only meaningful once there are abstractions to measure.

## P0 - Scaffold, harness, reference model

**Goal.** A package that runs zero tests and zero benchmarks successfully, so
that from P1 onward every commit has somewhere to land.

**Deliverables.**

- `packages/ecs/package.json` - `@jolly-pixel/ecs`, `"private": true`,
  `"type": "module"`. Scripts follow repo convention: `build` (tsc),
  `test-only`, `test` (c8 html reporter), `bench`, `bench:compare`.
- `packages/ecs/tsconfig.json` extending `tsconfig.base.json`.
- Root `package.json` `workspaces` array gains `packages/ecs`.
- `README.md` carrying the non-goals table from SPEC.md section 1, verbatim,
  so scope creep has to argue with a checked-in document.
- `src/index.ts`, `test/setup.ts`.
- `test/model/NaiveWorld.ts` - a deliberately naive reference ECS built on
  `Map` and `Set`. Obviously correct, no optimization, roughly 150 lines. It
  is the oracle for every differential test and the floor for every
  benchmark.
- `test/fuzz/harness.ts` - seeded PRNG, an operation-sequence generator, a
  runner that applies each sequence to both implementations and compares
  observable state, and a shrinker that minimises a failing sequence before
  printing it.
- `bench/_harness.ts` - tinybench wrapper implementing the methodology in
  section 15: min-of-3, committed baseline comparison, checksum assertion
  before any timing is reported.
- `bench/baseline.json` - empty, populated from P1 onward.

**Tests.** A smoke test proving the harness detects a deliberately broken
model. A harness that cannot fail is worthless, so this is the one test that
must be written before the harness is trusted.

**Done when.** `npm run test -w @jolly-pixel/ecs` and
`npm run bench -w @jolly-pixel/ecs` both exit clean, and `npm run lint`
passes at the repo root.

## P1 - Entity core

**Goal.** Entities exist, recycle, and can be checked for staleness.

**Deliverables.**

- `src/entity/layout.ts` - `configureEntityLayout`, `INDEX_MASK`,
  `entityIndex`, `entityGeneration`, `packEntity`, the `EntityId` branded
  type. Throws if reconfigured after a `World` exists.
- `src/World.ts` - capacity, growth, the free list, the generation
  `Uint32Array`, `spawn`, `createEntities`, `destroy`, `exists`.
- `src/World.invariants.ts` - `__checkInvariants()` covering SPEC.md
  invariants 4, 5, 6, 8 (the ones meaningful without components).

**Tests.** Units for pack and unpack round-trips at both layout extremes,
free-list reuse order, idempotent destroy, wraparound behaviour at a
deliberately tiny generation width, capacity-exceeded throwing. Fuzz
vocabulary gains `spawn`, `createEntities`, `destroy`, `exists`.

**Benchmarks.** `entity-cycle.bench.ts` - create and destroy churn at 10k,
100k, and 1M, against the naive model, `bitecs`, and
`@jolly-pixel/engine`'s `new Actor()` path.

**Done when.** Fuzz runs 100k operations across 50 seeds with invariants
asserted after every operation, and the first baseline numbers are committed.

## P2 - Registry and stores

**Goal.** Components can be defined, attached, detached, and tested for.

**Deliverables.**

- `src/component/registry.ts` - name uniqueness, bit assignment, word-count
  derivation.
- `src/component/bitset.ts` - the flat per-entity `Uint32Array`, `setBit`,
  `clearBit`, `testBit`, growth.
- `src/component/sparseSet.ts` - shared dense and sparse structure with O(1)
  add and swap-remove.
- `src/component/defineComponent.ts` - the SoA factory, field types
  (`i8` through `f64`, `bool`, `eid`, fixed-size arrays), column allocation
  and growth.
- `src/component/defineTag.ts`, `src/component/defineObject.ts`.
- `World.add`, `World.remove`, `World.has`; destroy now clears every store.
- The reserved `sceneId` `u16` column on every entity, written with a
  constant 0 until P7. Reserving it now costs nothing and means the partition
  is not retrofitted into a storage layer that assumed it away.
- `defineObject` enforcing the `serialize`/`deserialize` or `transient`
  requirement at definition time, and `defineComponent` accepting the `eid`
  field type. Neither is *used* until P4; both exist now so nothing has to be
  retrofitted.

**Tests.** Units per store kind. Type-level tests asserting
`defineComponent({ x: f32 })` infers `{ x: Float32Array }`, that `[f32, 3]`
infers correctly, and that `defineObject<T>` round-trips `T`. Fuzz vocabulary
gains `add`, `remove`, `has`; invariants 1, 2, 4 come online.

**Benchmarks.** `component-churn.bench.ts` - add and remove throughput, `has`
throughput, and growth cost across a resize boundary.

**Done when.** Fuzz runs a mixed entity-and-component vocabulary clean, and
the type-test suite passes with no `any` leaking out of the factories.

## P3 - DX vertical slice

**Goal.** Make the core usable through the API people will actually write,
while the core is still soft enough to change in response.

This phase produces no new capability. Its entire purpose is to put the
ergonomic surface in front of the storage layer early, so that every later
phase can be exercised through it and any friction is discovered now rather
than at P10.

**Deliverables.**

- `src/dx/Entity.ts` - the wrapper class, the intern table, lazy
  materialization, `world.createEntity(name?)` and `world.entity(id)`.
- `src/dx/Component.ts` - the data-only class base, `typeName`, automatic
  registration into an object store on subclassing.
- `Entity` methods forwarding to the core: `addComponent`,
  `addComponentAndGet`, `getComponent`, `getComponents`, `destroy`,
  `isDestroyed`.
- Intern-table release on destroy.
- A first cut of the additive-invariant benchmark (SPEC.md section 15),
  asserting the core path is unchanged with the DX tier loaded.

**Tests.** Identity units: `world.entity(id) === world.entity(id)`, and a
destroyed entity's wrapper reports `isDestroyed()` rather than resolving. A
churn test proving the intern table does not grow without bound (invariant
10). Fuzz vocabulary gains `materialize` and `release`.

**Benchmarks.** `dx-slice.bench.ts` - `createEntity` versus `spawn`,
`getComponent` versus direct store access, and the additive-invariant check.
These are the first published abstraction-tax numbers.

**Done when.** Every P1 and P2 capability is reachable through the DX tier,
the additive invariant holds, and the tax numbers are committed to the
baseline.

## P4 - Serialization

**Goal.** A world survives a round-trip through both encoders with entity
references intact.

**Deliverables.**

- `src/serialize/snapshot.ts` - `world.snapshot()`, the format-agnostic
  intermediate, walking stores directly.
- `src/serialize/json.ts`, `src/serialize/binary.ts`.
- `src/serialize/restore.ts` - `World.restore()`, dense compaction, the remap
  table, automatic rewriting of every `eid` column.
- `src/serialize/instantiate.ts` - restoring a snapshot into a *live* world
  rather than an empty one. This is the operation prefabs and additive scene
  loading are both built from (P7), so it is built once, here.
- Transient handling: skipped on snapshot, reported in the restore result.
- Format version field and the `onUnknownComponent` policy.

**Tests.** Golden files committed for a small representative world, byte
compared for the binary encoder and text compared for JSON. Round-trip
property test: `snapshot` then `encode` then `decode` then `restore` then
`snapshot` is a fixed point (invariant 9), driven by fuzz-generated worlds
rather than hand-written ones. A dedicated `eid` remap test using a synthetic
`Link { target: eid }` component, since `HierarchyComponent` does not exist
until P9. Instantiation tests: the same snapshot instantiated twice into one
world produces two disjoint entity sets with correctly remapped internal
references and no aliasing between them. Explicit tests for the
unknown-component error path and the transient-drop report.

**Benchmarks.** `snapshot.bench.ts` - snapshot and restore of 100k entities,
both encoders, plus encoded size. `instantiate.bench.ts` - repeated
instantiation of a small snapshot, which is the prefab-spawning hot path.

**Done when.** Fixed-point property holds across 50 fuzz-generated worlds,
double-instantiation is proven non-aliasing, and golden files are committed.

## P5 - Queries

**Goal.** The piece that turns this from storage into an ECS, and the first
point at which the performance question can actually be answered.

**Deliverables.**

- `src/query/Matcher.ts` - immutable chain (`empty`, `nothing`, `all`, `any`,
  `none`), compiling once to `allMask` / `anyMask` / `noneMask` word arrays.
- `src/query/Query.ts` - per-query sparse set, `count`, `dense`, iteration,
  the `sorted` option with lazy re-sort.
- `src/query/QueryCache.ts` - registration indexed by component bit,
  incremental update on add, remove, and destroy.
- `src/query/lock.ts` - the iteration lock and the deferral routing it needs
  (the buffer it routes into arrives in P6; until then a locked mutation
  throws, which is what the tests assert).
- `world.query(matcher, options)` memoized by compiled mask.

**Tests.** Matcher immutability and compilation units. Cache-correctness
fuzz: invariant 3 recomputed from scratch after every operation, with queries
registered both before and after the entities that match them. Lock tests
asserting a mutation during iteration is deferred or thrown rather than
corrupting the dense array.

**Benchmarks.** The full suite lands here.

| Bench | Measures |
|---|---|
| `packed-1.bench.ts`, `packed-5.bench.ts` | best-case iteration, 1 and 5 components |
| `simple-iter.bench.ts` | mixed read and write over 3 components |
| `fragmented-iter.bench.ts` | many distinct component shapes, the archetype-design stress case |
| `cache-storm.bench.ts` | high structural churn against many registered queries |
| `sorted-vs-unsorted.bench.ts` | settles the SPEC.md section 7 default |

**Done when.** All five benches run against the naive model, `bitecs`, and
the engine's `Actor` path, numbers are committed to `bench/baseline.json`,
and `sorted-vs-unsorted` has produced a defaults decision recorded in
SPEC.md.

## P6 - Systems, scheduler, command buffer

**Goal.** Logic has somewhere to live, and structural change is safe.

**Deliverables.**

- `src/system/System.ts` - the single base class, hooks (`onInitialize`,
  `onDestroy`, `onAdded`, `onRemoved`, `onBegin`, `process`, `lateProcess`,
  `onEnd`, `onCheckProcessing`), and the statics (`matcher`, `stage`,
  `order`, `before`, `after`, `interval`).
- `src/system/Scheduler.ts` - five stages, topological sort with cycle
  detection that throws, tiebreak chain.
- `src/system/CommandBuffer.ts` - FIFO queue, dead-entity skipping, flush at
  stage boundary, and the receiving end of P5's iteration-lock routing.
- `onAdded` and `onRemoved` wired to query-cache deltas.

**Tests.** Scheduler ordering units, including a cycle that must throw and a
diamond that must resolve deterministically. Interval gating with an injected
clock. Command-buffer ordering, dead-entity skipping, and flush timing. Fuzz
vocabulary gains `run` and `flush`; invariant 7 comes online. A regression
test reproducing the `ECS_AUDIT.md` `needUpdate` bug shape (mutating the
iterated set from inside `process`) and asserting no entity is skipped.

**Benchmarks.** `schedule.bench.ts` - per-system per-frame overhead at
varying system counts. `structural-churn.bench.ts` - buffered versus
immediate structural change, to confirm the batching claim rather than assume
it.

**Done when.** The audit regression test passes, and scheduler resolution is
proven deterministic across 1000 shuffled registration orders.

## P7 - Scenes

**Goal.** The thing most ECS libraries get wrong or skip. A world holds many
concurrent scenes, transitions are safe, and prefabs fall out of machinery
that already exists.

**Deliverables.**

- `src/scene/SceneId.ts` - monotonic, never-reused ids with tombstoning;
  configurable width.
- `src/scene/partition.ts` - the `sceneId` column becomes live, creation
  context assigns it, `world.createScene(name)`, `world.getScene(id)`,
  `world.destroyScene(id)` as an O(scene-size) dense walk.
- `Persistent` tag, honoured by `destroyScene`; `entity.isOrphaned()`.
- `Matcher.inScene(id)` and scene-scoped query compilation.
- `src/scene/SceneLoad.ts`, `SceneLoadDriver`, `SceneLoader` - the state
  machine ported from `packages/engine`, with `AssetLoadProgress` and
  `AssetRecord` replaced by a structural progress shape so the package stays
  dependency-free.
- Activation as a command applied at the `startup` stage boundary.
- `NotStarted` and `PendingDestroy` tags with their built-in draining
  systems, replacing `componentsToBeStarted`, `componentsToBeDestroyed`, and
  the `#cachedActors` snapshot.
- `world.snapshotScene(id)` and `world.instantiate(snapshot, { scene })`,
  built on P4's instantiation path. Prefabs need no new mechanism.

**Tests.** Partition units: creation context assignment, bulk destroy,
persistence exclusion, tombstone behaviour (invariants 11 to 14). State
machine tests ported from the engine's existing scene-load specs, including
`activation: "manual"` gating, cancellation, and failure, all driven by a
fake loader so they stay headless. Ordering tests pinning activation relative
to `NotStarted` draining and command-buffer flushing, since SPEC.md section 19
names that as a correctness property rather than an implementation detail. A
regression test for the behaviour the engine's retry hack existed to
produce: a component belonging to a not-yet-active scene must not start
early. Additive-scene tests: two scenes live at once, destroying one leaves
the other untouched. Fuzz vocabulary gains `createScene`, `destroyScene`,
`setPersistent`, and `activate`.

**Benchmarks.** `scene-destroy.bench.ts` - bulk destroy of a 100k-entity
scene versus destroying the same entities individually, and versus the
engine's cascade-from-owned-roots path. `scene-swap.bench.ts` - full
transition cost. `prefab-spawn.bench.ts` - instantiating a 50-entity prefab
1000 times.

**Done when.** Additive scenes, transitions, persistence, and prefab
instantiation all pass under fuzz, and the three arrays plus the retry hack
are provably gone rather than reimplemented.

## P8 - Change detection

**Goal.** "Did this change" becomes an integer comparison.

**Deliverables.**

- `track: true` option allocating the parallel epoch column.
- `touch(idx)` and the generated `write(id, partial)` helper.
- World epoch counter incremented once per `systems.run`.
- `query.changedSince(epoch)`, `Component.hasChanged(idx, since)`, and the
  per-system auto-advancing checkpoint.
- The debug-build shadow-copy assertion that catches unstamped writes.

**Tests.** Units for stamping, checkpoint advance, and epoch overflow at a
deliberately small width. A test asserting the shadow-copy assertion actually
fires on a deliberately unstamped write, on the same principle as the P0
smoke test. Fuzz vocabulary gains `touch` and `changedSince`.

**Benchmarks.** `changed-ratio.bench.ts` - the same workload at 100 percent,
10 percent, and 1 percent changed, to test ESEngine's claimed 10x and 100x
reductions against a real implementation.

**Done when.** The changed-ratio curve is measured and recorded, whatever it
shows.

## P9 - Hierarchy and transforms

**Goal.** The most persuasive benchmark this package can produce.

**Deliverables.**

- `src/hierarchy/HierarchyComponent.ts` - the SoA columns (`parent`,
  `firstChild`, `nextSibling`, `depth`).
- `src/hierarchy/HierarchySystem.ts` - ESEngine's method set: `setParent`,
  `insertChildAt`, `removeChild`, `removeAllChildren`, `getParent`,
  `getChildren`, `getRoot`, `getRootEntities`, `isAncestorOf`,
  `isDescendantOf`, `getDepth`, `findChild`, `forEachChild`. `setParent`
  rejects cycles and depth-cap violations.
- `findByPath(pattern)` - picomatch path matching carried over from
  `ActorTree.getActors`, kept deliberately outside `Matcher`.
- `src/transform/LocalTransform.ts`, `src/transform/WorldTransform.ts`.
- `src/transform/TransformPropagationSystem.ts` - dirty-subtree walk driven
  by the P8 epoch column, writing into preallocated matrix columns, with no
  allocation in steady state.

**Tests.** Hierarchy units including cycle rejection, depth-cap rejection,
reparenting mid-tree, and destroying a parent. Cross-scene parenting: what
happens when a child's scene is destroyed and the parent's is not. `findByPath`
tests ported from the engine's existing `ActorTree` specs, so behaviour is
provably unchanged. Propagation correctness compared against a
straightforward matrix-composition reference. A zero-allocation assertion in
steady state via heap sampling. `eid` remapping re-validated against real
`HierarchyComponent` data, closing the loop on the synthetic P4 test and on
prefab instantiation of a nested hierarchy.

**Benchmarks.** `transform-propagation.bench.ts` - 100k nodes, deep tree
versus wide tree versus flat, full-dirty versus 1-percent-dirty, against
`Object3D.updateMatrixWorld` and against the engine's `Transform` methods,
with heap delta measured under `--expose-gc`.

**Done when.** Steady-state propagation allocates nothing measurable and the
comparison against the current engine's transform path is recorded.

## P10 - The DX tier

**Goal.** Make the whole thing worth using, and prove what that costs.

**Deliverables.**

- `src/dx/Script.ts` - the scripting base class replacing today's
  `Behavior`, with `awake`, `start`, `update`, `fixedUpdate`, `destroy`
  unchanged.
- `src/dx/ScriptSystem.ts` - the single built-in system that batches over the
  `Script` object store and drives the lifecycle. There is no per-entity
  "needs update" array anywhere; the set is a query.
- `src/dx/Scene.ts` - the lifecycle class binding to a core `SceneId`,
  carrying declared `assets` and the `awake`/`start`/`update`/`fixedUpdate`/
  `destroy` hooks, with creation context wired so entities made in `awake()`
  inherit the scene id.
- `src/dx/Transform.ts` - the facade over `LocalTransform` and
  `WorldTransform`, preserving today's method names, with per-instance
  scratch objects rather than the `static` singletons the audit flags as
  clobber-prone.
- `src/dx/decorators.ts` - `@SceneProperty`, `@SceneActorComponent`,
  `@InputListener`, attached to `Script` only, kept in the DX tier so the
  core stays free of `reflect-metadata`.
- Per-entity iteration form over a query, with its cost published.
- `Entity.setParent` and hierarchy convenience methods forwarding to
  `HierarchySystem`.

**Tests.** Script lifecycle ordering, including that a script added during
`update` starts on the next frame and not mid-iteration. Scene lifecycle
ordering against the core state machine. Decorator metadata tests ported from
the engine's existing `Behavior` specs. Transform facade equivalence against
the engine's `Transform` for a representative set of operations, so the
rename is provably behaviour-preserving.

**Benchmarks.** The abstraction-tax suite, and it is the deliverable of this
phase as much as the code is:

| Bench | Compares |
|---|---|
| `tax-entity.bench.ts` | `Entity` methods versus raw `EntityId` core calls |
| `tax-script.bench.ts` | `Script.update` dispatch versus an equivalent `System` |
| `tax-transform.bench.ts` | `Transform` facade versus direct column access |
| `tax-iteration.bench.ts` | per-entity callback versus batch `process` |
| `tax-additive.bench.ts` | core path with the DX tier loaded versus absent |

Every ratio is written into the API documentation beside the abstraction it
measures.

**Done when.** The additive invariant holds under `tax-additive`, and every
abstraction in the tier has a published number next to it.

## P11 - Three binding and report

**Goal.** Answer whether this could actually replace the engine.

**Deliverables.**

- `src/three/Object3DRef.ts` - `defineObject<THREE.Object3D>`, transient.
- `src/three/ThreeSyncSystem.ts` - world matrix copied out,
  `matrixAutoUpdate = false`.
- A `three` export path in `package.json`, and `three` as a peer and dev
  dependency only.
- An example reproducing an existing `packages/engine` sample scene on this
  package, side by side with the original for DX comparison. It must exercise
  a real scene transition with async asset loading, since that is the part of
  the engine most likely to reveal a gap.
- `BENCHMARK.md` - every number, the methodology, and the machine it ran on.
- `RETROSPECTIVE.md` - what the design got right, what it got wrong, what the
  archetype question looks like in hindsight, and what a migration of
  `voxel-renderer` or `runtime` would actually cost.

**Tests.** The binding is tested with a stubbed Object3D, so the core test
suite stays headless. No Playwright, no browser, consistent with the recorded
preference that non-critical example workspaces get manual validation rather
than e2e.

**Done when.** The example runs, the report is written, and there is a
document a human can read to decide whether this becomes the engine.

The exit is a judgement call, deliberately. There is no pre-committed
threshold: the report presents the numbers and the DX comparison, and the
replacement decision is taken separately on that evidence.

## 14. Testing strategy

Four tiers, all under `node:test` with `node:assert` in strict mode, coverage
via `c8` with an enforced threshold in the `test` script.

**Unit specs.** Per module, under `test/`, `*.spec.ts`.

**Differential fuzzing.** The load-bearing tier. A seeded generator produces
operation sequences drawn from the vocabulary each phase adds; every sequence
runs against both `NaiveWorld` and the real implementation, and observable
state is compared after each step. On mismatch the shrinker minimises the
sequence and prints it as a reproducible seed plus op list, which then
becomes a committed regression test.

This tier exists because the bugs in a sparse-set and incremental-cache
design do not live in single calls. They live in sequences: destroy an entity
whose index is immediately recycled into a query that was locked during the
previous stage, or activate a scene in the same frame its loader failed. No
realistic amount of hand-written unit testing finds that class of bug; a few
million random sequences does.

**Golden files.** Serialization only. Committed, diffable, byte compared.

**Type-level tests.** `defineComponent` schema inference, query tuple typing,
and `defineObject<T>` round-trips. The repo has `noImplicitAny` off, so
generic inference silently degrading to `any` would otherwise go unnoticed.

## 15. Benchmark methodology

Built on tinybench, following the harness pattern already established in
`packages/voxel-renderer/bench` and `packages/pixel-draw-renderer/bench`.

**Comparison targets.** Three, always:

| Target | Role |
|---|---|
| `NaiveWorld` | correctness floor; a result slower than naive is a bug, not a trade-off |
| `bitecs` | raw-performance ceiling; the gap is the price of flexibility |
| `@jolly-pixel/engine` `Actor` path | the delta that actually justifies the project |

All three are devDependencies. `@jolly-pixel/ecs` does not depend on
`@jolly-pixel/engine`, so there is no workspace cycle.

**Rules.**

1. Every bench asserts a correctness checksum on its output before reporting
   any timing. A fast wrong answer is the easiest result to produce
   accidentally.
2. Min-of-3 runs, never the mean of one.
3. Numbers compare against a committed `bench/baseline.json` via
   `bench:compare`; a regression is a diff, not a memory.
4. Memory is measured as well as time, under `--expose-gc`, after a forced
   collection.
5. Every DX abstraction is benchmarked against its raw equivalent, and the
   ratio is published in the docs beside it (SPEC.md section 15). An
   unmeasured abstraction is not shippable.
6. No CI gating. Benchmarks on a shared runner are too noisy to gate on, and
   a flaky gate gets disabled rather than fixed. They are a local discipline
   with a checked-in baseline, which is how the other two packages in this
   repo already do it.

## 16. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Incremental query-cache invalidation bugs | High | Differential fuzz built in P0, invariant 3 recomputed from scratch after every op |
| DX tier bolted on too late to shape the core | High | P3 vertical slice, before serialization and queries |
| Scene transition ordering bugs | High | Activation, tag draining, and buffer flush all land at stage boundaries; ordering pinned by invariant 14 and explicit tests, and fuzzed |
| Stale column references after growth | High | SPEC.md section 19; debug build stamps column generations |
| Abstraction tax accumulating invisibly | Medium | The additive invariant, enforced by `tax-additive.bench.ts`; every abstraction publishes its ratio |
| Unstamped writes silently breaking change detection | Medium | Debug shadow-copy assertion, tested to actually fire |
| `Entity` intern table leaking on churn | Medium | Invariant 10 plus a dedicated churn test |
| Scene scope pulling asset loading into the core | Medium | The `SceneLoader` interface is the boundary; progress types are structural, and the core has no asset dependency |
| Orphaned entities surprising scene-scoped queries | Medium | `isOrphaned()` makes the condition askable; invariants 11 to 13 pin the semantics |
| Data-only rule eroding back into components | Medium | `Script` exists as the obvious alternative; lint rule if it shows up in practice |
| Serialization at P4 constraining later design | Medium | Accepted deliberately; the intermediate is format-agnostic so encoders can change without touching stores |
| Benchmark noise hiding regressions | Medium | Min-of-3, committed baseline, checksums, no CI gating |
| Scope creep from the non-goals list | Medium | Non-goals table checked into README.md |
| Archetype storage turning out to be the right answer | Low | Bench suite is storage-agnostic, so an archetype backend can be measured against the same scenarios later |
| Spike quietly becoming permanent without judgement | Low | P11 ships a retrospective and a migration-cost estimate, not just code |

## 17. Open questions

Deliberately unresolved, to be answered by evidence rather than by argument:

- **Should `Script` move up to P6?** It is a System, so it could ship
  alongside them. It sits in P10 here to keep the abstraction-tax bench suite
  in one piece. If early scripting ergonomics matter more than a unified
  bench phase, moving it is cheap.
- **Scene id width.** `u16` gives 65,535 scene creations per world lifetime
  with no reuse. Fine for a game, possibly not for an editor session that
  instantiates prefabs as scenes. Settled by watching a real editor session.
- **Default entity layout.** 20/12 is a starting point. The right split
  depends on whether real workloads hit the entity cap or the generation wrap
  first.
- **Sorted versus unsorted query default.** Settled by
  `sorted-vs-unsorted.bench.ts` in P5.
- **Does `picomatch` stay a dependency?** `findByPath` is the only consumer.
  If the glob subset actually used is small, inlining it keeps the core
  dependency-free.
- **Cross-scene hierarchy.** A parent in scene A with a child in scene B is
  currently allowed and orphans the child when A dies. Whether that should be
  rejected outright is a P9 question once real usage exists.
- **Whether an archetype backend is worth a P12.** Answered by the fragmented
  iteration numbers in P5, not before.
