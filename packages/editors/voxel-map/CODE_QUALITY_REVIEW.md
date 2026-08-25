# Voxel map code quality review

Date: 2026-08-25

Scope: the `@jolly-pixel/editor.voxel-map` workspace, including 29 source
modules, four test modules, package configuration, README, and changelog.
Monorepo dependencies were treated as external contracts unless their public
types were needed to understand this package.

## Implementation update

All package-local findings were addressed on 2026-08-25:

| Finding | Resolution |
|---|---|
| Cached texture race | Stale image completions are rejected with a generation token. |
| Preview GPU leaks | Preview objects use recursive, deduplicated disposal; unchanged cells are reused by block ID and definition identity. |
| Listener leaks | Typed subscriptions return disposers; Lit, ECS, bridge, and persistence owners release them. |
| Unvalidated JSON | File and local-storage input use the renderer's canonical voxel document decoder. |
| Fake block removal | The unsupported Remove command was removed. |
| Zero dimensions | All object extents pass through `normalizeVoxelExtent()`. |
| Invalid state/event types | Selection is one discriminated value and events are keyed by a typed event map. |
| Chatty mutations | Block updates batch invalidation and notification. Arbitrary drag reordering was removed until the engine exposes an atomic index move; Up/Down remain single commands. |
| Hidden readiness/offline path | Bootstrap awaits `loadRuntime()`, supports `?offline`, and joins rooms only after sync adapters attach. |
| Incomplete quality gate | Source and tests are typechecked and linted; c8 wraps the package tests. |
| Metadata/docs mismatch | npm publish configuration was removed, sibling workspace metadata conventions were restored, and README/API documentation now describe the application. |

The findings below are retained as the original audit record.

## Verdict

The package is small enough to recover without a broad rewrite. Source
compilation, the 27 runtime tests, source lint, and direct test lint all pass.
The separate test TypeScript project does not compile. More importantly, the
green checks miss several lifecycle and state-boundary defects.

The main design problem is ownership. World mutations, editor selection,
network synchronization, persistence, renderer invalidation, and UI refreshes
are coordinated through a global `EditorState`, string event names, and direct
engine calls from many components. Comments explain the ordering rules that
the types and APIs do not express. The next structural step should introduce a
typed editor document/session boundary and route mutations through it.

No source file exceeds 459 lines. Splitting files by size would move complexity
around without fixing the ownership problem.

## Findings

### 1. Cached texture loads can overwrite the wrong tileset

Severity: high

`TextureEditorBridge.loadTileset()` stores the requested tileset in mutable
instance fields, then starts an asynchronous `Image` load. Its callback later
calls `syncToThree()`, which reads the current fields. If tileset A starts
loading and the user selects tileset B first, A's callback can apply A's image
to B and cache the result under B's key.

Evidence:

- `src/lib/TextureEditorBridge.ts:68-80` starts the uncancelled image load.
- `src/lib/TextureEditorBridge.ts:127-139` writes through the current
  `#tilesetManager` and `#tilesetId`.

Remedy: give each load a generation token or an `AbortController`. Capture the
requested id and renderer in the callback, then discard completions whose token
is no longer current. Add a test that resolves two fake images in reverse
order.

### 2. Block preview refreshes leak GPU resources

Severity: high

Every block registry event creates a new block array. The viewport passes it to
`BlockLibraryRenderer.setBlocks()`, which rebuilds all preview meshes. The old
path disposes geometry only when the root is a `THREE.Mesh`; it never disposes
materials and misses descendants of `THREE.Group`. `dispose()` removes the
objects without disposing their geometry or materials at all.

Evidence:

- `src/ui/BlockLibrary.ts:100-108` and `src/ui/BlockLibrary.ts:438-446` refresh
  the array after registry events.
- `src/ui/BlockLibraryViewport.ts:74-76` forwards every new array.
- `src/lib/BlockLibraryRenderer.ts:99-115` performs the rebuild.
- `src/lib/BlockLibraryRenderer.ts:144-151` leaves GPU resources alive.

Remedy: add one recursive disposal function for preview objects and use it from
both paths. Then update cells by block id so editing one definition does not
rebuild the entire grid. The existing performance HUD can verify that geometry
and material counts remain stable during repeated edits.

### 3. Global listeners outlive their owners

Severity: high

Several long-lived objects attach anonymous callbacks to the singleton
`editorState` and never detach them. A destroyed or reconnected scene can leave
old renderers reachable and make later events run more than once.

Affected sites include:

- `src/ui/EditorSidebar.ts:87-97`
- `src/components/LayerGizmo.ts:61-80`
- `src/components/ObjectLayerRenderer.ts:92-115`
- `src/components/ObjectLayerVisuals.ts:86-91`
- `src/lib/LocalStoragePersistence.ts:47-61`

`LocalStoragePersistence` has no `stop()` method, its document listener is
anonymous, and `EditorScene` does not retain the persistence instance for
cleanup.

Remedy: use named callbacks or an owner-scoped `AbortController`. ECS
components should cancel their subscriptions in `destroy()`; Lit components
should cancel in `disconnectedCallback()`. Make persistence an owned scene
resource with `start()` and `stop()`.

### 4. World JSON crosses the boundary by assertion

Severity: high

Both load paths cast `JSON.parse()` directly to `VoxelWorldJSON`. TypeScript
then trusts unvalidated user or storage data. Invalid shapes can reach
`engine.load()` or the network replacement path and fail after state mutation
has begun.

Evidence:

- `src/lib/LocalStoragePersistence.ts:20-29`
- `src/ui/MapConfigPanel.ts:98-119`

Remedy: parse into `unknown`, validate it with the canonical voxel-world parser
if the renderer exports one, and add that parser upstream if it does not. The
boundary should return a `VoxelWorldJSON` only after validation. Report syntax
and schema failures to the user without altering the current world.

### 5. The Remove block command does not remove anything

Severity: high

The toolbar exposes `- Remove`, but `#removeBlock()` only clears local
selection. The block remains in the registry and in `_blocks`, so it remains
visible after the next render. The adjacent comment claims the display is
rebuilt without the block, but no such rebuild occurs.

Evidence: `src/ui/BlockLibrary.ts:164-170` and
`src/ui/BlockLibrary.ts:314-325`.

Remedy: remove the command until the registry has a safe deletion contract, or
add that contract in the owning package. A real deletion needs an explicit
policy for placed voxels that reference the block. Do not simulate deletion
with component-local filtering because saved and networked state would still
contain the definition.

### 6. Object dimensions admit zero, then divide by it

Severity: high

The size control declares `min="0"`, and its handler rounds without clamping.
The renderer preserves zero because it uses `?? 1`; the scale handler later
divides by the initial width and height. A zero dimension can therefore produce
an infinite transform scale.

Evidence:

- `src/ui/ObjectLayerPanel.ts:167-175`
- `src/ui/ObjectLayerPanel.ts:270-286`
- `src/components/ObjectLayerRenderer.ts:77-88`

Remedy: define one positive voxel-extent constructor or value object and use it
at every UI, JSON, and engine boundary. Clamp to at least one before the value
enters renderer state. Test zero, negative, fractional, and non-finite input.

### 7. The event and selection types allow states the domain does not

Severity: medium

`EditorState` models a selection as two nullable fields and publishes it over
untyped `EventTarget` strings. Consumers cast `Event` back to
`CustomEvent<T>`, and some commands recover invariants with non-null
assertions. The compiler cannot correlate an event name with its detail type or
prove that a selected layer has a kind.

Evidence:

- `src/EditorState.ts:13-19` stores layer name and kind separately.
- `src/EditorState.ts:88-105` dispatches separate selection events.
- `src/ui/LayerPanel.ts:61-63` and
  `src/components/LayerGizmo.ts:68-70` assert event details.
- `src/components/VoxelBrush.ts:244` and
  `src/components/VoxelBrush.ts:263` assert the layer is selected.

Remedy: replace the pair with a discriminated union:

```ts
type LayerSelection =
  | { type: "voxel"; name: string; }
  | { type: "object"; name: string; }
  | null;
```

Add a typed event map or typed subscription API whose key determines the
payload. Commands should accept the narrowed selection value instead of
reading the global singleton again. Branded identifiers may help at engine
boundaries, but the discriminated selection removes more complexity first.

### 8. Mutation orchestration is repeated, chatty, and non-atomic

Severity: medium

`applyBlockUpdate()` is a useful first step, but it still couples a registry
write to global UI state and labels every dirty operation `BlockLibrary update`
even when the caller is the UV or texture bridge. Transparency synchronization
calls it once per affected block, causing a full chunk invalidation and global
event for every item. Layer reordering likewise emits one mutation per crossed
row.

Evidence:

- `src/lib/applyBlockUpdate.ts:15-22`
- `src/lib/TextureEditorBridge.ts:151-169`
- `src/ui/LayerManager.ts:241-283`

Remedy: move document mutations behind a session command API. It should support
`updateBlocks(iterable)` and an index-based layer move, apply related changes as
one operation, mark rendering dirty once, and publish one typed change set.
The index-based move probably belongs in the voxel engine because it owns layer
ordering.

### 9. Bootstrap uses domain events as readiness signals

Severity: medium

`index.ts` waits for the first `blockRegistryChanged` event to obtain
`EditorScene.vr` and `gridRenderer`. Comments in both files explain the exact
construction order needed for this to work. This is a hidden initialization
protocol.

The same bootstrap always creates `worldRoom`, then evaluates
`worldRoom ? null : LocalStoragePersistence.load()`. The local load branch is
unreachable from this entry point even though `EditorScene` contains a complete
offline path.

Evidence:

- `src/index.ts:87-102`
- `src/index.ts:123-130`
- `src/scene/editor.ts:149-180`

Remedy: make scene initialization return an explicit ready value containing
the renderer and grid. Select networked or offline mode from configuration
before creating the room. If offline mode is obsolete, delete its branches and
persistence code instead of keeping an uncallable second mode.

### 10. The quality gate excludes tests from compilation

Severity: medium

`npx tsc --noEmit` succeeds because the package tsconfig includes only `src`.
`npx tsc --noEmit -p test/tsconfig.json` fails at
`test/lib/TextureEditorBridge.spec.ts:167`: the object-literal setter's `this`
type is inferred as `{}`, so `assigned` does not exist. Runtime tests still
pass because Node erases the types.

The package `lint` script covers only `src`, although direct test lint happens
to pass. The `test` script has no c8 coverage wiring. Only four production
modules are imported directly by tests; scene setup, Lit components, renderer
resource cleanup, and ECS lifecycle behavior have no package-level tests.

Remedy: add a `typecheck` script that checks both tsconfigs and make CI call it.
Include `test/**/*.ts` in lint. Fix the fake with an explicitly typed backing
object or closure rather than another assertion. Add c8 to the package test
script in the same form used by the monorepo's covered packages.

### 11. Package metadata and API documentation disagree

Severity: medium

`package.json` declares the package private while also defining npm publish
metadata and a `prepublish` build. README says the package is installable, then
ends its usage section with `TBC`. This leaves no documented public API,
startup contract, network requirement, or persistence behavior.

Evidence:

- `package.json:6-18`
- `README.md:11-20`

Remedy: decide whether this is an application-only workspace or a publishable
package. Remove the unused half of the configuration. Replace the placeholder
with a short architecture and development guide, then document exported APIs
only if the package is meant to expose them.

## What is already solid

- Production code contains no explicit `any`.
- Relative internal imports use `.ts`, and source compilation respects the
  repository's strict base config.
- The UV and texture bridges have focused unit tests with useful edge cases.
- Components such as `PerformanceHUD`, `BlockUvBridge`, and
  `BlockLibraryViewport` already show explicit cleanup patterns that can be
  reused elsewhere.
- Files are below the 1,000-line review threshold. The largest is
  `src/ui/BlockLibrary.ts` at 459 lines.

## Remediation plan

### Phase 1: stop data loss and leaks

1. Tokenize or cancel texture loads and add the reverse-completion test.
2. Dispose preview geometry and materials, then add a stable-resource-count
   test around repeated block updates.
3. Remove or implement the block deletion command.
4. Reject invalid world JSON before calling the engine.
5. Clamp object dimensions at one canonical boundary.

These changes can be separate issues and should land before the larger
refactor.

### Phase 2: create the canonical document boundary

Introduce an `EditorDocument` or `EditorSession` that owns the renderer,
selection, subscriptions, mutation commands, persistence, and synchronization
clients. Replace the layer name/type pair with `LayerSelection`. Expose typed
change sets and owner-scoped subscriptions. Batch block updates and layer
reordering through this boundary.

Keep rendering components focused on rendering. Lit components should submit
commands and render state; they should not decide persistence, network, or
dirty-chunk policy.

### Phase 3: make initialization and teardown explicit

Return initialized scene handles directly instead of treating
`blockRegistryChanged` as a ready event. Add `stop()` or `dispose()` to every
long-lived collaborator and test one full create, destroy, create cycle. Decide
whether offline mode remains supported.

### Phase 4: tighten the gate and documentation

Compile source and tests in CI, lint both trees, wire c8, and cover the
currently untested UI and ECS lifecycles. Resolve the private/publishable
package decision. Replace README's placeholder with actual setup and usage.

### Phase 5: trim comments after the design is clearer

Apply the companion comment audit in
`source-comments.ai-slop-report.md`. Remove comments that narrate visible code,
compress the comments that preserve an invariant, and move public contracts to
API documentation. Do this after the session and lifecycle changes so comments
are not rewritten twice.

## Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run test` | pass, 27 tests |
| `npm run lint` | pass, source only |
| `npx eslint test/**/*.ts` | pass |
| `npx tsc --noEmit -p test/tsconfig.json` | fail at `TextureEditorBridge.spec.ts:167` |

No source code was changed during this review.
