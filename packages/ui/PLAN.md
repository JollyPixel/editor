# @jolly-pixel/ui implementation plan

Steps for the contracts in [SPEC.md](./SPEC.md). Each phase lists the files it creates, the
tests it must carry, what it deletes, and the condition for calling it done.

Phases are ordered so that every one after P2 retires code. Nothing is built without a consumer
lined up to prove it.

Conventions: `src/` mirrors the catalog sections in SPEC section 5. Every component ships
`X.ts`, `X.styles.ts` and `docs/X.md` in the same commit, per the repository preference for
documentation and tests written alongside implementation, never after.

## P0: foundation

No components. Everything later depends on this.

**Create**

```
src/theme/ramps.ts             OKLCH ramps, tier 1, accent seeded
                               from #4488ff
src/theme/tokens.ts            tier 2 semantics, light-dark(var(--ramp)),
                               one declaration each, about 30 names
src/theme/density.ts           compact 18/11, default 22/12,
                               comfortable 28/13
src/theme/scales.ts            4px spacing grid, radius sm 3 / md 5,
                               durations fast 100 / base 160, easing
src/theme/peerColor.ts         golden angle hue rotation at fixed L and C
src/theme/types.ts             ThemeMode, Density
src/field/mixed.ts             Mixed (Symbol.for, unique symbol),
                               FieldValue<T>, isMixed
src/storage/StorageAdapter.ts  the port
src/storage/LocalStorageAdapter.ts  handles construction and write failure
src/storage/MemoryStorageAdapter.ts  also the fallback the above degrades to
src/storage/keys.ts            deriveKey(tagName, label, occurrence),
                               resolveOrder()
src/geometry/valueFromDelta.ts object param: start, deltaPx, step,
                               pixelsPerStep, multiplier, min, max
src/expression/evaluate.ts     tokenizer + shunting yard, EvalResult, no eval
src/index.ts                   narrow barrel, see below
docs/theming.md                tokens, tiers, theme attribute, density,
                               override recipe
test/setup.ts                  full global set incl. Document, ShadowRoot,
                               CSSStyleSheet, HTMLTemplateElement
test/e2e/constants.ts          PORT 3001, BASE_URL (3000 is pixel-art's)
playwright.config.ts
examples/index.html            the only page
examples/tsconfig.json         nothing type checks the gallery today
examples/scripts/main.ts       route, mount, dispose, __galleryReady
examples/scripts/manifest.ts   examples declare themselves
examples/scripts/types.ts      GalleryExample
examples/scripts/shell/        plain nav + main for now, swapped for
                               jolly-dock + jolly-list in P2
```

The barrel exports only the consumer facing surface: the theme tokens, `Mixed`, `FieldValue`,
`isMixed` and `StorageAdapter`. `evaluate`, `deriveKey`, `resolveOrder` and `valueFromDelta` stay
internal, imported by relative path inside the package and from `test/`. This package publishes
with `access: public`, so a barrel that re-exports everything makes four implementation details
into API that has to be supported; promoting one later is additive, un-publishing one is
breaking.

**Deliberately not created here.** Every one of these appeared in an earlier draft of P0 and has
no consumer in it, which is the rule this plan opens with:

| Not in P0 | Where it went | Why |
|---|---|---|
| `theme/contrast.ts` | deleted | Its only consumer was the contrast suite, which SPEC section 4 no longer asserts in code |
| `input/ShortcutRegistry.ts`, `input/matchBinding.ts` | unscheduled | No phase registers a binding; SPEC section 16 still questions whether rebindable shortcuts are wanted |
| `input/InputScope.ts`, `input/FocusScopeTracker.ts` | P6 | Consumer is voxel-map. Built here it sits unexercised for five phases |
| `field/JollyField.ts` | P1 | A base class with six reactive properties designed against zero implementations |
| `geometry/sizeFromDelta.ts` | `resize-handle`, P2 | That package already computes it inline and is what actually runs |
| `geometry/clampToViewport.ts` | P2 | Its signature hides questions only `jolly-floating` answers |
| `examples/scripts/stateMatrix.ts` | P1 | Its rows are `JollyField` states, which do not exist yet |

The shell cannot dogfood yet: `jolly-dock` and `jolly-list` do not exist until P2. Routing,
the manifest, `chrome=off` and `__galleryReady` are settled here and do not change when the
shell's internals are replaced, so no test is rewritten by that swap — which only holds because
those tests are written here. P0 therefore ships the shell's e2e suite, not unit tests alone; a
routing contract with nothing asserting it is not settled, it is merely written down.

Two placeholder examples, not one. A single entry cannot exercise the interesting half of
`GalleryExample`: that `render()` returns a teardown and switching examples calls it. Left
unproven until P1, the first leak gets attributed to a component rather than to the shell.

**Package wiring**

- Add `lit` as peer `^3.3.0` and pinned dev `3.3.3`. The caret is hand edited: `.npmrc` sets
  `save-exact=true`, so npm will not write a range
- Replace the bare `"exports": "./dist/index.js"` string with the object form
  `{ ".": { "types": …, "default": … } }` that `pixel-draw-renderer` uses. The current form
  ships no `types` condition at all, so consumers get no types today. **Only `"."`** — `./stats`
  and `./network` are declared in P3b and P7, with the code they point at
- Rename the `preview` script to `dev` so Playwright's `webServer` matches pixel-art
- Move the test glob from `test/**/*.test.ts` to `test/**/*.spec.ts`, mirroring pixel-art, the
  only other package running node:test and Playwright together
- Add `test:e2e`, and `--import ./test/setup.ts` to `test-only`
- Add `tsconfig.tsbuildinfo` to `prepublish`'s `rimraf`. Copied verbatim from every other
  package, `rimraf ./dist && tsc -b` carries the stale buildinfo trap: `tsc -b` sees a fresh
  buildinfo, concludes nothing changed, and silently emits nothing into the deleted `dist`
- Pin `runtime`'s `lit@^3.3.1` range to `3.3.3`

`@jolly-pixel/resize-handle` is **not** added here. Its consumer is `jolly-dock` in P2, which is
also where that package gains the `handle` option.

`@playwright/test`, `happy-dom`, `c8` and `vite` are already root devDependencies and hoisted, so
this package adds none of them.

**Changes in `packages/engine`**

Independent of everything else here, and worth landing first because the current behaviour makes
the UI unreachable by keyboard.

In `src/controls/devices/keyboard/Keyboard.class.ts`:

- Export `isEditableTarget(event)`, resolving through `composedPath()` so retargeted shadow DOM
  events find the real control, with a `typeof event.composedPath === "function"` fallback to
  `event.target` for synthetic events. It lives here, not in `DocumentAdapter`: the adapter exists
  for test injection, and policy there means every future adapter reimplements it
- Guard `#onKeyDown` and `#onKeyPress` with it. **Not `#onKeyUp`** — guarding the release strands
  keys. Hold `W` on the canvas, `Tab` into a field, release: the guard swallows the `keyup`,
  `KeyW` stays in `buttonsDown`, and the camera drifts forever. Deleting a key that was never
  added is a harmless no-op, so the asymmetry is correct
- `#onKeyPress` matters as much as `#onKeyDown`: it accumulates `newChar`, so typing in a field
  currently feeds the text to any consumer polling `keyboard.char`
- Remove **both** `Tab` and `Escape` from `kControlKeys`. `Tab`, so focus can leave the canvas —
  every UI side fix is defeated without it. `Escape`, because native `dialog`'s close is a
  browser default action that `preventDefault()` suppresses; leaving it in means P2's
  `dialog-escape` case passes in the gallery, where no engine runs, and silently fails in every
  editor. No in-repo consumer depends on either being prevented: the four hand rolled `Escape`
  handlers in pixel-art, voxel-map and voxel-model are listeners, which still fire

These are behaviour changes to a published package with its own suite, so they ship as **their own
PR**, landed first — reviewable on their own merits and revertable without touching `ui`. A
**minor** changeset records the change and the one line opt-out, since that is what a consumer
reads in the changelog:

```ts
keyboard.on("Tab", (event) => event.preventDefault());
```

**Unit tests**, all pure:

- `deriveKey` — slug normalisation (accented labels, punctuation, empty), occurrence suffixes
- `resolveOrder` — dropped keys, new keys inserted after their surviving declared sibling, new
  key at the front, ties
- `StorageAdapter` — a stub throwing on the property read, and a stub throwing on `setItem`
  after a successful construction
- `valueFromDelta` — sensitivity, clamping, step quantisation and float drift, multiplier
- `evaluate` — precedence, parentheses, unary minus, scientific and comma decimals, `1/0` and
  non-finite results as errors, the plain-number fast path, and grammar closure: unknown
  identifiers, call syntax `f(1)`, property access `a.b` and string literals all fail to parse.
  Grammar closure, not a denylist — a parser rejects `alert(1)` because `a` is not a token, and
  framing it as "rejecting `eval` shaped input" invites someone to add a denylist later

**E2e**, the shell's own suite, per SPEC section 13: the nav renders every manifest entry,
selecting one swaps the content, a deep link selects the right entry, `chrome=off` renders the
example with no shell, switching runs the previous example's teardown, and the manifest sweep —
every example mounts and disposes without throwing — which grows by itself from here on.

Contrast is not asserted in code; see SPEC section 4 for why, and for the targets that still hold.

**Done when**: `npm run build -w @jolly-pixel/ui`, `npm run test -w @jolly-pixel/ui` and
`npm run test:e2e -w @jolly-pixel/ui` pass, lint is clean, `npm ls lit` shows a single deduped
copy, both placeholder examples serve at `/?example=<id>&chrome=off`, and no component exists yet.

## P0 delivery

Two pull requests, `engine` first.

**PR 1 — `engine`.** The keyboard changes above, their tests, and a **minor** changeset. Separate
rather than a separate commit, so a behaviour change to a published package is reviewed on its own
merits, lands independently, and can be reverted without touching `ui`.

**PR 2 — `ui`.** Five commits, in this order. Only the last has a hard dependency:

1. **Docs.** The amended `SPEC.md` and `PLAN.md`, so everything after is reviewed against a
   document describing what was actually decided
2. **Harness.** `package.json`, the tsconfigs, `examples/tsconfig.json`, `playwright.config.ts`,
   `test/e2e/constants.ts`, `test/setup.ts`, and `examples/src` renamed to `examples/scripts`.
   Nothing else can land first
3. **Theme.** `ramps`, `tokens`, `density`, `scales`, `peerColor`, `types`, `docs/theming.md`
4. **Pure kernel.** `mixed`, `storage/*`, `geometry/valueFromDelta`, `expression/evaluate`, and
   their specs
5. **Gallery.** `manifest`, `types`, `main`, `shell/`, two placeholders, the shell e2e suite.
   Needs 2

Commits 3 and 4 are independent of each other and of 5.

**Changesets.** `engine` minor, as above. `runtime` **patch**, for the `lit` range pin. **None for
`ui`**: it is unpublished at `1.0.0` and P0 ships no public API worth a release — its first
changeset comes with P1.

`README.md` stays `TBC`. A readme documenting an empty package ages badly, and its usage example
would be rewritten the moment P1 lands.

## P1: controls

**Create first**, moved out of P0 so each lands with the code that proves it:

- `src/field/JollyField.ts` — the base class (`label`, `description`, `value`, `default`,
  `lockedBy`, `error`), in the same commit as the first control that extends it
- `examples/scripts/stateMatrix.ts` — the shared default/mixed/locked/error/modified/disabled
  rows tagged `[data-state]`, in the same commit as the first component example that renders
  through it

**Create** under `src/controls/`: `Button`, `ButtonGroup`, `Checkbox`, `Number`, `Slider`,
`Range`, `Text`, `Select`, `Flags`, `Color`, `Separator`, `PropertyRow`.

Each extends `JollyField` and implements the full state channel table of SPEC section 4: focus as
a native outset `outline`, lock as an inset `box-shadow` ring in the holder's peer colour, error
on the border, revert in the gutter, `Mixed` as a dash placeholder, peers as stacked chips
overflowing to `+N`, hover and active as background steps, disabled as opacity. A locked field
also sets `aria-disabled` and goes read only, never `inert`.

The combinations are what matter: locked plus focused must show both rings, and mixed plus
modified must show both affordances.

`Number` wires drag scrub through `valueFromDelta` and expression input through `evaluate`.

**Create** `src/icon/Icon.ts` plus a registry, holding only the chrome glyphs: chevron, close,
revert, drag, lock, eye, search.

**Tests**: unit for value formatting, mixed handling, revert predicate, expression commit and
error paths. One component example per control, plus an e2e pass over drag scrub, revert click,
and a locked plus focused field showing both rings at once, reached through
`/?example=controls/<id>&chrome=off`.

Density is verified through the `density` scenario example, once per preset, not per component.

**Done when**: every control renders in the gallery in both themes and all three densities, and
overriding `--jolly-accent-fill` on the gallery root visibly changes all of them.

## P2: containers and chrome

**Create** under `src/containers/`: `Pane`, `Folder`, `Tabs`, `Tab`, `Dock`, `Floating`,
`Dialog`, `Toolbar`, `Rail`, `Split`.

**Create** `src/geometry/clampToViewport.ts`, moved out of P0 — its signature depends on
questions only `jolly-floating` answers (is `rect` the element's size or its current box, does the
whole element stay in view or a grab handle's worth, does scroll count).

**Add** the `@jolly-pixel/resize-handle` dependency, also moved out of P0.

**Change** `packages/resize-handle/src/index.ts`, two things:

- Add the optional `handle` to `ResizeHandleOptions`, skipping sibling injection when supplied.
  Additive, so those tests stay green untouched
- Extract the inline drag math at `src/index.ts:145-149` into a pure exported
  `sizeFromDelta({ initialSize, startDrag, current, fromStart, min, max })`, tested in that
  package. It currently applies **no clamp**, so a pane can be dragged to a negative width; the
  clamp is a real fix, and it does change drag behaviour, so unlike the `handle` option this part
  is not purely additive and its tests move with it

`ui` does not own size-from-delta. `jolly-dock` delegates resizing to `resize-handle`, which does
the DOM writes, so a copy here would never be the code that runs.

`Dock` renders the handle in its shadow root, targets itself, ships the styling, and injects the
single `html.handle-dragging` rule once.

`Dialog` wraps native `dialog` plus `showModal()`. Export `showPrompt()` and `showConfirm()`
built on `Promise.withResolvers`.

Folder reorder lands here, using `resolveOrder` and the `StorageAdapter`.

**Gallery shell swap**: replace `examples/scripts/shell/` internals with `jolly-dock` holding a
grouped `jolly-list`, plus a theme toggle and a density selector in the dock header, which
dogfoods `jolly-button-group` and `jolly-select`. Routes, `chrome=off` and `__galleryReady` are
unchanged, so only the shell's own five tests are touched.

**Tests**: unit for reorder reconciliation and dialog promise settlement. E2e for handle drag
resizing a dock, double click collapse, reorder persisting across reload, floating pane clamped
inside the viewport, Escape closing a dialog.

**Deletes**: `.resize-handle` and `html.handle-dragging` blocks from
`editors/pixel-art/examples/public/main.css`, `editors/voxel-map/public/main.css` and
`editors/voxel-model/public/main.css`, once those editors adopt `jolly-dock` in P5 and P6. Until
then the rules coexist.

**Done when**: a gallery page shows a left dock, a right dock and a floating pane at once, all
resizable and reorderable, with order surviving reload.

## P3: facade, and the end of Tweakpane

**Create** under `src/facade/`: `Pane`, `Folder`, `Binding`, `Monitor`, `Button`, `Blade`, plus
`dispatch.ts` choosing an element from the bound value's type.

Facade surface: `addFolder`, `addBinding`, `addMonitor`, `addButton`, `addBlade`, `refresh`,
`dispose`, `hidden`, `disabled`, `element`.

**Create** under `src/monitors/`: `Monitor` (label and value row), `Graph` (ring buffer
sparkline). No internal timer, the application pushes values.

**Migrate**

- `packages/voxel-renderer/examples/scripts/utils/pane.ts`
- `packages/three/examples/scripts/utils/pane.ts`
- `packages/three/examples/scripts/demo-grid.ts`, `demo-peer-frustum.ts`

**Deletes**: both `utils/pane.ts` copies, and the `tweakpane` plus `@tweakpane/core`
dependencies from `packages/three/package.json` and `packages/voxel-renderer/package.json`.

The two `PerformancePanel.ts` copies and voxel-map's `PerformanceHUD.ts` are handled in P3b, not
here: they become stats consumers rather than pane consumers.

**Tests**: unit for type dispatch and for `addMonitors` style formatting helpers carried over.
E2e over one migrated example page confirming the example switcher and the F3 toggle still work.

**Done when**: no `tweakpane` import remains outside `node_modules`, and both example suites run
against the facade.

## P3b: stats

Separable from P3 and independently shippable. Retires four performance readouts.

**Create**

```
src/stats/StatsRecorder.ts     timing, refresh window, ring buffers,
                               begin() / end() / track() / addMetric() /
                               snapshot() / subscribe()
src/stats/MetricDefinition.ts  the public metric interface
src/stats/builtins.ts          fps, ms, worstMs, mb (registered through
                               the same public interface)
src/stats/Stats.ts             jolly-stats, canvas, cycle on click
src/stats/Stats.styles.ts
src/stats/resolveTokens.ts     getComputedStyle bridge, canvas cannot
                               read custom properties
```

Add the `./stats` subpath to `exports`, DOM free, no Lit.

**Migrate**

- `packages/runtime/src/Runtime.ts`: dynamic `import("@jolly-pixel/ui/stats")` behind
  `includePerformanceStats`, `begin()` and `end()` call sites unchanged
- `packages/voxel-renderer/examples/scripts/components/PerformancePanel.ts`
- `packages/three/examples/scripts/components/PerformancePanel.ts`
- `packages/editors/voxel-map/src/components/PerformanceHUD.ts` (297 lines), whose renderer and
  voxel metrics become registered `sample()` definitions

**Deletes**

- the `stats.js` dependency from `packages/runtime/package.json`
- `this.stats.dom.removeAttribute("style")` in `Runtime.ts`
- `.stats` CSS in `packages/runtime/examples/public/main.css` and
  `packages/editors/voxel-map/public/main.css`
- the three hand rolled frame accumulators (`#frames`, `#elapsed`, `#worstFrame`)
- voxel-map's inlined copy of `addMonitors` and `formatCount`

**Tests**: unit is the bulk here, since the recorder is DOM free. Fake clock over `begin()` and
`end()`, aggregation modes (`last`, `average`, `max`), ring buffer wraparound, auto scaling
bounds, `sample()` pulled once per window for every registered metric including hidden ones, and
`mb` absent when `performance.memory` is not exposed. E2e for click and keyboard cycling, and for
the selected metric surviving reload.

**Done when**: no `stats.js` import remains outside `node_modules`, the HUD follows the `theme`
attribute, and `voxel-renderer/bench` can construct a recorder with no DOM present.

## P4: math components

**Create** under `src/math/`: `Vector2`, `Vector3`, `Vector4`, `Quaternion`, `Transform`,
`Point2d`, plus `src/math/euler.ts` for quaternion conversion and `src/math/equals.ts` for the
`hasChanged` comparators.

Axis chips reuse P1's drag scrub. Mixed applies per axis.

**Tests**: unit for quaternion and Euler round trips across the order convention and near gimbal
poles, and for component wise equality. E2e for dragging an axis chip and for the 2D pad.

**Deletes**: `editors/voxel-map/src/ui/Vec2Input.ts` and `Vec3Input.ts` once voxel-map migrates
in P6. The `.axis-input` markup in `editors/voxel-model/src/components/tabs/Build.ts` goes in P5.

**Done when**: `<jolly-vector3 .value=${mesh.position}>` renders a Three.js vector with no
`three` dependency in this package.

## P5: data views, and voxel-model

**Create** under `src/data/`: `Tree`, `List`, `Search`, `Menu`, `Toast`, `Progress`.

`Tree` takes generic nodes (`{ id, label, children }`), supports drag and drop reparenting with
above, below and inside drop zones, collapsible groups, and visibility plus lock toggles. It
knows nothing about scenes.

**Migrate** `editors/voxel-model`: `LeftPanel` onto `jolly-rail` plus `jolly-tabs`, `RightPanel`
onto `jolly-tree`, `PopupManager` and `AddMeshPopup` onto `jolly-dialog`, `tabs/Build` and
`tabs/Paint` onto P1 and P4 controls.

**Deletes**: `PopupManager.ts`, the tree implementation inside `RightPanel.ts` (about 330 lines),
and the hardcoded palettes across those six components.

**Tests**: unit for reparent target resolution, which is pure given a node list and a drop
target. E2e for dragging a node onto, above and below another, and for context menu open and
dismiss.

**Done when**: voxel-model renders entirely from `@jolly-pixel/ui`, responds to the `theme`
attribute, and declares no component local colors.

## P6: voxel-map

**Migrate** the twelve components in `editors/voxel-map/src/ui/`, about 3,100 lines:
`EditorSidebar`, `LayerPanel`, `LayerManager`, `ObjectLayerPanel`, `MapConfigPanel`,
`TilesetManager`, `BlockLibrary`, `PromptDialog`, `Icon`, `TextureEditor`, `Vec2Input`,
`Vec3Input`.

`BlockLibrary`'s viewport host and the tileset domain logic stay in the editor, rebuilt on
`jolly-pane`, `jolly-toolbar`, `jolly-list` and `jolly-search`.

**Deletes**: `PromptDialog.ts` (replaced by `showPrompt`), `Icon.ts`, `Vec2Input.ts`,
`Vec3Input.ts`, and every hardcoded hex across the remaining files.

**Input scope**: **create** `src/input/InputScope.ts` (the `InputScope` type and
`InputScopeSource` port) and `src/input/FocusScopeTracker.ts` (`focusin`/`focusout` over
`composedPath()`), moved out of P0 to land with their consumer. Then replace the hover based
`world.input.keyboard.setEnabled(!hovering)` in `src/index.ts` with the focus based wiring of SPEC
section 9. This is the editor that has the workaround, so it is the one that proves the
replacement — and building the port five phases earlier would mean its first contact with a real
focus tree came after forty five components existed.

The `input-scope` scenario example and the end to end cases listed below move here from P7.

**Watch**: `editors/voxel-map` depends on `pixel-draw-renderer` through `"*"`, resolving to
`dist/`. Rebuild that package before its tests pick up changes.

**Done when**: voxel-map renders from `@jolly-pixel/ui`, and its `public/main.css` no longer
carries resize handle rules.

## P7: presence and locking

**Create** `src/collab/PresenceSource.ts` (port and types), `src/collab/Presence.ts`
(`jolly-presence`), `src/collab/LockController.ts` (Lit reactive controller claiming on focus and
releasing on blur), and `src/network/RoomPresenceSource.ts` behind the `./network` subpath,
importing `@jolly-pixel/network/client`.

Wire `lockedBy` through `JollyField` so every control already built lights up without changes.

**Tests**: unit for the presence to schema mapping and for claim and release against a fake
source, no transport. E2e with two browser contexts in one room, asserting that focusing a field
in one marks it held in the other, and that closing the first releases it.

**Done when**: two browsers in one room show each other's avatars and field locks, and no core
module imports anything from `@jolly-pixel/network`.

## P8: pixel-art consolidation

**Migrate** `editors/pixel-art/src/ui`: `theme.ts` onto the shared tokens, `ModeRail` onto
`jolly-rail`, the colour rail and swatch onto `jolly-color`.

The six reactive controllers stay: they hold pixel-art domain logic, which is out of scope here.

**Deletes**: `theme.ts` and its threefold token duplication, `mode-rail/`, and whichever colour
components `jolly-color` subsumes.

**Watch**: `PixelDrawPanel` composes `themeStyles` into `static styles`. Under the new model it
becomes a token consumer, so it must sit inside a scope host or set its own.

**Done when**: pixel-art declares no tokens of its own and its e2e theme suite still passes.

## Verification per phase

```bash
npm run build -w @jolly-pixel/ui
npm run test -w @jolly-pixel/ui
npm run test:e2e -w @jolly-pixel/ui
npm run lint
```

A phase is complete only when the packages it migrated also pass their own suites, and when the
deletions listed for it have actually happened. A migration that adds the new component without
removing the old one leaves the duplication this package exists to remove.

## Example accrual

Every phase from P1 on adds its examples in the same commit as the component, never later. A
component without a gallery entry has no end to end coverage, since the gallery is the only
fixture.

The manifest sweep (every example mounts and disposes without throwing) runs from P1 and grows
by itself as entries are added.

| Phase | Component examples | Scenario examples |
|---|---|---|
| P1 | 12 controls | `density`, `theme`, `expression`, `drag-scrub` |
| P2 | 10 containers | `reorder-persist`, `dock-resize`, `dialog-escape` |
| P3 | monitor, graph | `facade-parity` |
| P3b | stats | `stats-cycle` |
| P4 | 6 math | `mixed-per-axis` |
| P5 | 6 data views | `tree-reparent`, `menu-dismiss` |
| P6 | — | `input-scope` |
| P7 | presence | `locking` (two contexts) |

## Input scope end to end coverage (P6)

The defect this closes is invisible to unit tests, so it gets explicit e2e cases against an
example page that runs a viewport and a pane together. The `engine` half lands in P0 and is
covered by that package's own suite; these cases cover the pairing, and run once
`FocusScopeTracker` exists in P6:

- Typing in a text field does not move the camera
- `Tab` from the canvas reaches the first control in the pane
- `Home`, `End` and the arrows move the caret inside a field instead of the camera
- `Delete` inside a field deletes a character
- `Escape` closes an open `jolly-dialog`
- Focus leaving the pane re-arms viewport input, and held keys do not stick

## Risks

| Risk | Handling |
|---|---|
| Two `lit` copies re-register tags and break class identity | Peer dependency, pinned in P0. `.npmrc` sets `package-lock=false`, so no lockfile holds the tree in place and a single copy can only be checked, not guaranteed: `npm ls lit` is part of P0's done-when |
| A duplicate `ui` instance breaks the `Mixed` sentinel the same way | `Symbol.for`, so identity survives module duplication. `Symbol()` would fail silently, rendering a mixed field as an ordinary value |
| Facade API shaped by one consumer | Examples migrate at P3, before either editor |
| `jolly-tree` under specified against one consumer | Generic node shape, reparent resolution kept pure and unit tested |
| E2e flakiness, as recorded in pixel-art | Tier kept small, geometry pushed into pure functions, workers isolated |
| `resize-handle` change breaking existing users | `handle` is optional and its tests run unmodified. The `sizeFromDelta` extraction is not purely additive — clamping changes drag behaviour — so it carries its own tests and its own changeset |
| Migration diffs too large to review | One editor per phase, one component family per commit |
| `runtime` is published, and P3b adds a dependency to it | `./stats` is DOM free and imported dynamically behind `includePerformanceStats`, so game bundles are unaffected when the flag is off |
| Canvas colours drift from the theme | Tokens resolved through `getComputedStyle` and re-resolved on `theme` and colour scheme changes, asserted in e2e |
| Engine keyboard changes regress game input | Landed as their own commit with their own tests, and the guard only skips events already targeting an editable element |
| UI and viewport shortcuts collide silently | **Unhandled, accepted.** The central registry that would detect this is deferred and unscheduled (SPEC section 9), because no phase registers a binding through it. The design is recorded and ready; the risk stays open until a consumer asks |

