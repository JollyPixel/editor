# @jolly-pixel/ui implementation plan

Steps for [SPEC.md](./SPEC.md). Each phase lists creates, tests, deletions, and its completion
gate. From P2 onward every phase retires code; components ship with `X.ts`, `X.styles.ts`, and
documentation in the same commit.

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
src/numeric/valueFromDelta.ts  object param: start, deltaPx, step,
                               pixelsPerStep, multiplier, min, max
src/numeric/evaluate.ts        tokenizer + shunting yard, EvalResult, no eval
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
                               jolly-dock + grouped folders in P2
```

The barrel exports theme tokens, `Mixed`, `FieldValue`, `isMixed`, and `StorageAdapter` only.
`evaluate`, `deriveKey`, `resolveOrder`, and `valueFromDelta` remain internal; publishing them
would make implementation details permanent API.

**Deferred from P0** because it has no P0 consumer:

| Not in P0 | Where it went | Why |
|---|---|---|
| `theme/contrast.ts` | deleted | Its only consumer was the contrast suite, which SPEC section 4 no longer asserts in code |
| `input/ShortcutRegistry.ts`, `input/matchBinding.ts` | unscheduled | No phase registers a binding; SPEC section 16 still questions whether rebindable shortcuts are wanted |
| `input/InputScope.ts`, `input/FocusScopeTracker.ts` | P6 | Consumer is voxel-map. Built here it sits unexercised for five phases |
| `field/JollyField.ts` | P1 | A base class with six reactive properties designed against zero implementations |
| `geometry/sizeFromDelta.ts` | `resize-handle`, P2 | That package owns the drag math and is what actually runs |
| `geometry/clampToViewport.ts` | P2 | Floating defines fixed viewport coordinates and the oversized-axis fallback |
| `examples/scripts/stateMatrix.ts` | P1 | Its rows are `JollyField` states, which do not exist yet |

P0 uses a plain gallery shell because Dock, Pane and Folder arrive in P2. Its routing, manifest,
`chrome=off`, and `__galleryReady` contracts and e2e suite stay unchanged after that swap. Two
placeholders prove example teardown on navigation. `jolly-list` remains in P5.

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

`@jolly-pixel/resize-handle` arrives with its P2 consumer. The test and build tools are already
hoisted root dev dependencies.

**Changes in `packages/engine`**

Land this independently first: current keyboard handling makes the UI unreachable by keyboard.

In `src/controls/devices/keyboard/Keyboard.class.ts`:

- Export `isEditableTarget(event)`, based on `composedPath()` with an `event.target` fallback for
  synthetic events; policy belongs in `Keyboard`, not `DocumentAdapter`
- Guard `#onKeyDown` and `#onKeyPress`, never `#onKeyUp`, so a release after focus moves cannot
  strand a held key; `keypress` also protects `newChar`
- Remove `Tab` and `Escape` from `kControlKeys`, allowing focus to leave the canvas and native
  dialogs to close. Existing in-repo Escape listeners still fire

This published-package behaviour change ships first in its own PR with a **minor** changeset and
the opt-out:

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
- `evaluate` — precedence, parentheses, unary signs, scientific and comma decimals, non-finite
  failures, plain-number fast path, and grammar closure for identifiers, calls, properties, and
  string literals

**E2e**: manifest navigation, selection, deep link, `chrome=off`, teardown on switch, and a
mount-and-dispose sweep for every example.

Contrast is not asserted in code; see SPEC section 4 for why, and for the targets that still hold.

**Done when**: UI build, unit, e2e, and lint pass; `npm ls lit` is deduped; both placeholders
serve at `/?example=<id>&chrome=off`; and no component exists.

## P0 delivery

Two pull requests, `engine` first.

**PR 1 — `engine`.** Keyboard changes, tests, and a **minor** changeset.

**PR 2 — `ui`.** Five commits, in this order. Only the last has a hard dependency:

1. **Docs.** The amended `SPEC.md` and `PLAN.md`, so everything after is reviewed against a
   document describing what was actually decided
2. **Harness.** `package.json`, the tsconfigs, `examples/tsconfig.json`, `playwright.config.ts`,
   `test/e2e/constants.ts`, `test/setup.ts`, and `examples/src` renamed to `examples/scripts`.
   Nothing else can land first
3. **Theme.** `ramps`, `tokens`, `density`, `scales`, `peerColor`, `types`, `docs/theming.md`
4. **Pure kernel.** `mixed`, `storage/*`, `numeric/valueFromDelta`, `numeric/evaluate`, and
   their specs
5. **Gallery.** `manifest`, `types`, `main`, `shell/`, two placeholders, the shell e2e suite.
   Needs 2

Commits 3 and 4 are independent of 5. Changesets: `engine` minor, `runtime` patch for the Lit pin,
none for unpublished `ui`. `README.md` remains `TBC` until P1 provides usable API.

## P1: controls

**Create**

```
src/field/JollyField.ts        abstract JollyField<T>, sealed render(),
                               protected abstract renderValue()
src/field/JollyField.styles.ts row, gutter, label, value, chips, error
src/field/events.ts            JollyChangeDetail<T>, the emit helper
src/field/predicates.ts        isModified()
src/numeric/format.ts          formatNumber(), parseNumeric()
src/peer/types.ts              CollaboratorPresence, moved out of P7
src/theme/fallbacks.ts         the four narrow fallbacks, one source
src/controls/types.ts          JollyOption<T>, Interval
src/controls/flags.ts          mask to selection and back, pure
src/interaction/ScrubController.ts   wraps valueFromDelta
src/icon/registry.ts           registerIcon(), getIcon(), IconName
src/icon/builtins.ts           registered through the public function
src/icon/Icon.ts               jolly-icon
src/dom.ts                     isInputElement(), isSelectElement(),
                               detailOf(), mirroring pixel-art's guard

examples/scripts/stateMatrix.ts      nine rows, factory based
```

**Also fixed here**, found while building the state matrix: `Mixed` was declared without a type
annotation, so an exported `const` whose initializer is not a direct `Symbol()` call widened back
to `symbol`. `FieldValue<string>` was therefore `string | symbol` and had lost the distinctness
SPEC section 3 gives as the reason for the whole construction. Invisible at runtime, so P0's spec
passed; `test/field/mixed.spec.ts` now carries a type level guard that stops compiling if it
regresses.

`CollaboratorPresence` moves here from P7 into `src/peer/types.ts` because SPEC section 3 now renders `peers` and
`lockedBy` in P1. P7 supplies values and adds `PresenceSource` beside it, changing no control,
which was the whole argument for a base class in the first place.

**Create** under `src/controls/`: `Button`, `ButtonGroup`, `Checkbox`, `Number`, `Slider`,
`Range`, `Text`, `Select`, `Flags`, `Color`, `Separator`, `PropertyRow`.

Nine of them extend `JollyField<T>`. `Button`, `Separator` and `PropertyRow` extend `LitElement`:
the first has no value, so `default`, `Mixed` and revert are inert on it, and the other two are
layout.

| Extends `JollyField<T>` | `T` | Extends `LitElement` |
|---|---|---|
| `Checkbox` | `boolean` | `Button` |
| `Number`, `Slider` | `number` | `Separator` |
| `Range` | `Interval` | `PropertyRow` |
| `Text`, `Color` | `string` | |
| `Select`, `ButtonGroup` | `T` | |
| `Flags` | `number` | |

`JollyField` implements the full state channel table of SPEC section 4 once, so no control
implements any of it: focus as a native outset `outline`, lock as a leading bar and tint in
the holder's peer colour, error on the border, revert in the gutter, `Mixed` as a dash
placeholder, peers as stacked chips overflowing to `+N`, hover and active as background steps,
disabled as opacity. A locked field also sets `aria-disabled` and goes read only, never `inert`.

The combinations are what matter: locked plus focused must show both rings, and mixed plus
modified must show both affordances.

`Number` wires drag scrub through `ScrubController` and expression input through `evaluate`.
`Select` and `Color` wrap native elements per SPEC section 5, so no floating layer is pulled
forward from P2.

**Tests**. No spec can import a control, since a decorator is not erasable syntax and
`node --test` strips rather than compiles. Unit tests therefore target the extracted modules:
`predicates`, `numeric/format` and `controls/flags`, alongside P0's `evaluate` and
`valueFromDelta`.

End to end covers the rest, asserting resolved tokens against the properties consuming them
rather than pixels:

```
test/e2e/controls.e2e.ts      nine matrix rows per field, token wiring
test/e2e/interaction.e2e.ts   scrub, revert, expression, Escape discards
test/e2e/manifest.e2e.ts      every example mounts and disposes
```

Scrub cases use a small fixed `steps` count and assert the committed value rather than
intermediate frames, since pixel-art's spurious timeouts traced to step counts.

Density is verified through the `density` scenario example, once per preset, not per component.

**Docs**: `docs/fields.md` for the contract shared by nine controls, `docs/controls.md` with one
terse section each, `docs/icons.md` for the registry and the authoring grid. Not one page per
component: they would each repeat the same contract, including the write back warning that has to
appear first or nowhere.

**Barrel**: the twelve elements, `JollyOption`, `Interval`, `JollyChangeDetail`,
`CollaboratorPresence`, `registerIcon` and `IconName`. `JollyField`, `ScrubController` and the
pure helpers stay internal.

**Done when**: every control renders in the gallery in both themes and all three densities, and
overriding `--jolly-accent-fill` on the gallery root visibly changes all of them.

## P1 delivery

One pull request, nine commits. Docs first, so the eight after it are reviewed against a document
describing what was decided:

1. **Docs.** The amended `SPEC.md` and `PLAN.md`
2. **Field foundation.** `JollyField` and its styles, `events`, `predicates`, `numeric/format`,
   `peer/types`, `theme/fallbacks`, `controls/types`, and their specs. `icon/registry` comes
   with them rather than in 3, since `JollyOption.icon` is typed against `IconName`
3. **Icons.** `builtins` and the `Icon` element
4. **Scrub.** `ScrubController`
5. **Text, Number, Checkbox**, plus `stateMatrix` and the first e2e specs. These three prove every
   mechanism between them: draft state, scrub, expression and `#parseError`, native wrapping,
   `Mixed` as a dash and as `indeterminate`, revert, all nine rows
6. **Slider, Range, Flags**, plus `controls/flags` and its spec
7. **Select, Color, ButtonGroup**
8. **Button, Separator, PropertyRow**
9. **Docs and changeset.** `fields.md`, `controls.md`, `icons.md`, the scope host section in
   `theming.md`, `README.md` (which P0 deliberately left as `TBC`), the scenario examples, and a
   **minor** changeset for `@jolly-pixel/ui`

Commit 5 is the review checkpoint. If the base class is wrong it is wrong there, against three
controls rather than twelve.

### P1 source layout cleanup

After P1, the numeric helpers are grouped under `src/numeric/`: expression parsing,
formatting and quantisation, modifier scaling, and scrub-delta calculation. They describe one
feature shared by `Number`, `Range`, and `ScrubController`; `expression/` and `geometry/` would
misstate that relationship. `src/dom.ts` replaces the one-file `utils/` directory. The matching
unit tests live in `test/numeric/`. This is a move-only refactor with unchanged package exports
and control behaviour.

## P2: containers and chrome

**Create** under `src/containers/`: `Pane`, `Folder`, `Tabs`, `Tab`, `Dock`, `Floating`,
`Dialog`, `Toolbar`, `Rail`. Export the element constructor as `PaneElement`; `Pane` remains
available for the P3 facade. `jolly-split` is deferred until a consumer defines its sizing and
interaction contract.

**Create** `src/geometry/clampToViewport.ts`, moved out of P0. Floating uses fixed viewport
coordinates. A pane that fits stays fully visible. An oversized axis anchors at zero, retaining
the leading title region. Document scroll is not part of the calculation.

**Add** the `@jolly-pixel/resize-handle` dependency, also moved out of P0.

**Change** `packages/resize-handle/src/index.ts`:

- Add optional `handle`, `minSize` and `maxSize` options. Bounds default to zero and infinity;
  supplying a handle skips sibling injection
- Rename the unused `collapsable` option to `collapsible`. This is an accepted breaking change
- Extract the inline drag math at `src/index.ts:145-149` into a pure exported
  `sizeFromDelta({ initialSize, startDrag, current, fromStart, min, max })`, tested in that
  package. It currently applies no clamp, so a pane can be dragged to a negative width
- Make handles focusable ARIA separators. Arrow keys resize by 8px, Shift plus an arrow by 32px,
  through the same clamped function as pointer movement
- Add idempotent `dispose()`. It removes listeners, ends an active drag, clears document classes,
  and removes only handles injected by the class

`ui` does not own size-from-delta. `jolly-dock` delegates resizing to `resize-handle`, which does
the DOM writes, so a copy here would never be the code that runs.

`Pane` owns the optional title and `actions` slot and is a theme scope host. Folder reorder is
opt-in through Pane's `reorderable` attribute. Only direct Folder children move. Pane changes
slot order without moving Lit-owned light DOM, persists committed order through its
`StorageAdapter`, and emits `jolly-reorder`. Folder uses `open`, defaults open, persists expansion
and emits `jolly-toggle`. Its separate grip supports pointer drag and Space, Up, Down and Escape
keyboard reordering with live announcements.

`Tabs` owns a settable selected key and emits `jolly-change`. It uses automatic activation,
roving focus, orientation-specific arrows, Home and End, and skips disabled tabs.

`Dock` supports left, right, top and bottom. It renders the ResizeHandle handle in its shadow
root, targets itself, ships the styling, and injects the single `html.handle-dragging` rule once.
Dock owns collapse so its internal handle remains operable: double click and Enter toggle it,
and size plus collapsed state persist.

`Floating` moves from the non-interactive part of its nested Pane header and resizes from the
right and bottom edges. It clamps on connect, move, resize and viewport resize. Position and size
persist. Pointer interaction and `focusin` raise it within its current root; an explicit consumer
z-index wins and stack order does not persist.

Dock and Floating emit `jolly-resize` during interaction and `jolly-resize-end` on commit.
Floating also emits `jolly-move` and `jolly-move-end`. Keyboard resize and Dock collapse use the
same event path so later editor migrations can resize their canvases without special cases.

`Dialog` is the other P2 theme scope host. It wraps native `dialog` plus `showModal()` and is
dismissible by Escape or backdrop click unless `dismissible` is false. Export string-based
`showPrompt()` and `showConfirm()` helpers built on `Promise.withResolvers`. Prompt resolves a
trimmed string or `null`; Confirm resolves a boolean; every path settles and removes the helper
element once.

`Toolbar` and `Rail` are stateless layout. Toolbar provides toolbar semantics and orientation;
Rail is a persistent edge strip, vertical by default, sized for 32px icon controls.

**Gallery shell swap**: replace `examples/scripts/shell/` internals with `jolly-dock` holding a
reorderable Pane. Manifest groups become Folder elements containing the existing semantic nav
links. `jolly-list` stays in P5. The Pane actions slot holds a theme button group and density
select; the gallery shell persists both preferences. Routes, `chrome=off` and `__galleryReady`
remain unchanged.

**Unit tests**: `sizeFromDelta`, ResizeHandle bounds and disposal, and `clampToViewport` for panes
that fit and panes larger than either viewport axis. `resolveOrder` retains its P0 coverage.
Decorated dialog modules do not enter `node:test`.

**End to end**: pointer and keyboard Dock resizing, double click and Enter collapse, pointer and
keyboard Folder reorder with reload persistence, Floating move, resize, clamping and stacking,
Tabs keyboard activation, and Dialog confirmation, cancellation, Escape, backdrop, single
settlement and element removal.

**Docs and examples**: add one example for each of the nine P2 elements plus
`reorder-persist`, `dock-resize` and `dialog-escape` scenarios. Add container, placement and
dialog documentation in the same delivery as their components.

**Deletes**: `.resize-handle` and `html.handle-dragging` blocks from
`editors/pixel-art/examples/public/main.css`, `editors/voxel-map/public/main.css` and
`editors/voxel-model/public/main.css`, once those editors adopt `jolly-dock` in P5 and P6. Until
then the rules coexist.

**Done when**: one gallery scenario shows left and right Docks plus a Floating Pane. Docks and
Floating resize through pointer and keyboard input, Floating stays recoverable after viewport
changes, Folder order survives reload, and Dialog closes through native Escape handling.

### P2 delivery

Two ordered pull requests:

1. **resize-handle.** Supplied handles, numeric bounds, clamped `sizeFromDelta`, keyboard
   separators, the `collapsible` rename, lifecycle disposal, tests, and a major release
2. **ui.** Nine elements, geometry, persistence wiring, gallery migration, docs, browser tests,
   and a minor release

## P2b: colour picker

Inserted after P2, because the popup needs a layer and P2 is what proved `jolly-floating` is not
it. Independently shippable.

**Create**

```
src/color/types.ts             RGBA, HSVA
src/color/parse.ts             parseColor(), absorbing normalizeHex
src/color/format.ts            formatHex(rgba, withAlpha)
src/color/hsv.ts               rgbToHsv(), hsvToRgb()
src/color/area.ts              ratioFromPointer(), saturationValueFromPointer()
src/numeric/anchoredPosition.ts  below, flipped above, then clamped
src/interaction/PopoverController.ts  placement, reposition, focus restore, onCancel
src/controls/ColorPicker.ts    jolly-color-picker
src/controls/ColorPicker.styles.ts
```

`src/color/` is deliberately dependency-free and shaped to lift into `@jolly-pixel/color` verbatim.
That package is not created here: it would turn a UI feature into a cross-package extraction
touching `pixel-draw-renderer`, `editor.pixel-art`, `voxel-map` and `three`'s duplicate
`ColorPalette`.

**Rewrite** `src/controls/Color.ts`. The native `input[type="color"]` goes, replaced by a swatch
button opening the picker through `PopoverController`. Adds `alpha`, defaulting off so existing
consumers keep emitting six digits.

**Deletes**: `src/controls/hex.ts` and `test/controls/hex.spec.ts`, whose cases move to
`test/color/parse.spec.ts`. This retires one of the three duplicate hex parsers in the repository.

**Barrel**: `ColorPicker`, `PopoverController`, `parseColor`, `formatHex`, `RGBA`.
`anchoredPosition` and the remaining `src/color/` modules stay internal.

**Unit tests**, all pure, since no spec can import a decorated component: `parse` (shorthand,
alpha, partial input, four-digit rejection), `format` (padding, clamping, alpha drop, round trip),
`hsv` (sector placement, hue wrap, unit clamping, round trip, and the black collapse the tuple
exists to survive), `area` (corners, centre, clamping, zero-sized rect), `anchoredPosition`
(below, flip, clamp, oversized panel).

**E2e**: open and focus, drag commit, Escape revert, click-away accept, disabled row, alpha on and
off, the row's eight-digit hex field, the standalone panel's hex field and its invalid state, the
hue and saturation surviving a trip through black, a readonly panel, and the `PopoverController`
path with no `jolly-color` row at all.

**Examples**: `controls/color-picker`, `controls/color-alpha`, and the `scenarios/color-popover`
scenario, which is the standing proof that a picker in a popup does not require the field row.

**Not built**: eyedropper, preset swatches, `rgb`/`hsl` format switching, an inline mode on the row.

**Scheduled debt, not oversight**: `vanilla-picker` stays in `editors/pixel-art` until P8. Shipping
the component without retiring its predecessor is exactly what "Verification per phase" warns
against, so it is recorded here rather than left to be discovered. P8's colour work becomes
`ColorSwatch.ts` composing `PopoverController` with `jolly-color-picker` inside its existing
portal, which needs no `jolly-color` row.

**Done when**: the gallery shows the picker standalone, inside a `jolly-color` row, and inside a
popup built without one; and `npm run build`, unit, e2e and lint all pass.

## P3: facade, and the end of Tweakpane

**Create** under `src/facade/`: `Pane`, `Folder`, `Binding`, `Monitor`, `Button`, `Separator`, plus
`dispatch.ts` choosing an element from the bound value's type. Tweakpane calls its generic
non-value row a "Blade", of which `{ view: "separator" }` is one kind; nothing else in `ui`
speaks that vocabulary and no second blade kind is planned, so the facade names the class for
what it actually wraps.

The six facade classes split into two tiers. Container tier, `Pane` and `Folder`: `addFolder`,
`addBinding`, `addMonitor`, `addButton`, `addSeparator`, `refresh`, `dispose`, `hidden`,
`disabled`, `element`. Leaf tier, `Binding`, `Monitor`, `Button`, `Separator`: `dispose`, `hidden`,
`disabled`, `element`; `Binding` alone adds `on("change", ({ value, last }) => void)`, firing
after the automatic write-back for every `jolly-input` (`last: false`) and `jolly-change`
(`last: true`) from the dispatched element. A leaf never exposes `addFolder`; nothing here mirrors
Tweakpane's single `BladeApi` inheritance chain.

`dispatch.ts` picks an element from the bound value and, where given, `options`:

| Value / options | Element | Note |
|---|---|---|
| `boolean` | `jolly-checkbox` | |
| `number`, no `min`+`max` | `jolly-number` | `step` alone does not trigger a slider |
| `number`, `min` and `max` both set | `jolly-slider` | matches today's Tweakpane rendering exactly |
| `string`, matches `/^#[0-9a-f]{6}([0-9a-f]{2})?$/i` | `jolly-color` | shape sniffed, no `view` hint needed, mirrors Tweakpane's own auto-detection |
| `string`, otherwise | `jolly-text` | |
| any value, `options.options` set | `jolly-select` | always, regardless of option count; no button-group heuristic |
| `Interval` (`{ from, to }`) | `jolly-range` | vocabulary carried for parity; no P3 migration target exercises it |

`addMonitor(state, key, options)` dispatches on `options.view`: `"graph"` (with `min`, `max`,
optional `rows`) renders `jolly-graph`; anything else renders `jolly-monitor`. This is an opt-in
flag, not value-shape dispatch, mirroring Tweakpane's own `view: "graph"` on the one binding that
uses it today.

Bulk binding (Tweakpane's `addMonitors(folder, state, fields)` loop) is not part of the facade.
It stays local per package, a few lines calling the public `addMonitor` in a loop; the pattern has
no second real shape to validate against beyond the one demo that uses it, and promoting it now
would be building for an audience of one.

**Create** under `src/monitors/`: `Monitor` (label and value row), `Graph` (ring buffer
sparkline), `format.ts` (`formatCount`, `formatMilliseconds`, `formatPercent`, moved in from the
two duplicated `utils/pane.ts` copies). No internal timer, the application pushes values.

**Migrate**

- `packages/three/examples/scripts/utils/pane.ts` → deleted, replaced by
  `packages/three/examples/scripts/utils/example-switcher.ts`: only the example-switcher binding
  and `F3` visibility toggle survive, now calling the facade's `Pane` instead of tweakpane's.
  `formatCount`/`formatMilliseconds` move to `@jolly-pixel/ui`; `addMonitors` becomes a local loop
  over the public `addMonitor`
- `packages/voxel-renderer/examples/scripts/utils/pane.ts` → same treatment, same new filename
- `packages/three/examples/scripts/demo-grid.ts`, `demo-peer-frustum.ts` — every `addBinding`,
  `addFolder`, `addBlade({ view: "separator" })` call moves onto the facade per the dispatch table
  above; the separator calls become `addSeparator()`
- `packages/voxel-renderer/examples/scripts/demo-transparency.ts`, `demo-noise-world.ts` — same
  treatment. Not in the original scope note: both call `addFolder`/`addBinding` directly (layer
  visibility and opacity, light colour and intensities, the debug-mode dropdown, an unbounded
  `seed` field), the same way the two `three` demos do, and were missing from an earlier pass of
  this plan. Without migrating them the `tweakpane` dependency cannot actually be deleted from
  `voxel-renderer/package.json`
- `packages/voxel-renderer/examples/scripts/demo-shapes.ts`, `demo-tileset.ts`, `demo-physics.ts`,
  `demo-tiled.ts`, `demo-flat-world.ts` — no direct binding calls, only the `createExamplePane`
  import path changes

**PerformancePanel.ts (both copies) and voxel-map's PerformanceHUD.ts**: a minimal facade-type
swap only, not the full stats-consumer rearchitecture. Both `PerformancePanel.ts` copies hold the
same `Pane` instance `createExamplePane()` returns (`new PerformancePanel({ pane, renderer })` in
`demo-grid.ts`), so once that instance is the facade's `Pane` rather than tweakpane's, the type
import and the `pane.addFolder`/`folder.addBinding`/`folder.dispose()` calls must follow in the
same PR — otherwise the build breaks the moment `tweakpane` is removed, before P3b ever touches
these files. The `fps` graph binding becomes `folder.addMonitor(stats, "fps", { view: "graph",
min: 0, max: kGraphMaxFps, rows: kGraphRows })`; every other stat becomes a plain
`folder.addMonitor(stats, key, { format })`. The hand-rolled `#frames`/`#elapsed`/`#worstFrame`
accumulator, `voxel-map`'s duplicated `addMonitors`/`formatCount`, and the `PerformanceHUD.ts`
rewrite into a `StatsRecorder` consumer all stay P3b's job, unchanged from PLAN's existing
description of that phase.

**Deletes**: both `utils/pane.ts` copies (replaced by `example-switcher.ts`), and the `tweakpane`
plus `@tweakpane/core` dependencies from `packages/three/package.json` and
`packages/voxel-renderer/package.json`.

**Tests**: unit for `dispatch.ts`'s pure mapping and for `format.ts`'s three functions, both DOM
free. No unit coverage for the facade classes themselves: they wrap Lit elements, the same
"decorators are not erasable syntax" constraint that keeps every other component out of
`node:test`. No new Playwright harness for `packages/three` or `packages/voxel-renderer`: neither
package has one today, both are demo galleries rather than shipped product surfaces, and the
migrated pages are verified manually rather than by standing up e2e infrastructure and a CI job
entry for a demo switcher.

**Docs**: `docs/facade.md` for the builder API and its relationship to the element layer;
`docs/monitors.md` for `jolly-monitor`, `jolly-graph`, and the `addMonitor` `view: "graph"` flag.

**Not built**: `exportState`/`importState`. None of the four migrated demo files or the
`PerformancePanel` swap need it, and building a serialisation format for every dispatched control
type with no consumer to validate it against is exactly what SPEC section 15 rejects elsewhere.
Stays an open point (SPEC section 16) until a real consumer asks.

**Done when**: no `tweakpane` import remains outside `node_modules` in `packages/three` or
`packages/voxel-renderer`, `npm run build`/`test`/`lint` pass for all three packages, and every
migrated example page has been manually verified to render and behave as before.

### P3 delivery

One pull request across three packages, ui first:

1. **`@jolly-pixel/ui`.** `src/facade/` (six classes, `dispatch.ts`), `src/monitors/` (`Monitor`,
   `Graph`, `format.ts`), their unit specs, the `monitor`/`graph` gallery examples, the
   `facade-parity` scenario, `docs/facade.md`, `docs/monitors.md`, and a **minor** changeset
2. **`@jolly-pixel/three`.** `demo-grid.ts`, `demo-peer-frustum.ts`, `PerformancePanel.ts`,
   `utils/pane.ts` → `utils/example-switcher.ts`, `tweakpane`/`@tweakpane/core` removed from
   `package.json`, a **patch** changeset
3. **`@jolly-pixel/voxel.renderer`.** Same shape as commit 2, plus `demo-transparency.ts`,
   `demo-noise-world.ts`, and the five switcher-only demo pages' import updates, a **patch**
   changeset

Commit 1 is the review checkpoint: the facade's dispatch rules and event shape are established
there, against the gallery's own examples, before either editor package's migration depends on
them.

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

**Create** `src/peer/PresenceSource.ts` (port types beside the existing presence view),
`src/collab/LockController.ts` (Lit reactive controller claiming on focus and
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
`jolly-rail`, and the colour rail and swatch onto `jolly-color-picker` plus `PopoverController`.
Not onto `jolly-color`: the rail wants a brush colour, not a property row, so `ColorSwatch.ts`
keeps its own trigger and drops `vanilla-picker` and its portal. `ColorSwatch` already emits
`{ hex, opacity }`, which `parseColor` produces directly, so its event shape is unchanged.

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
| P2 | 9 containers | `reorder-persist`, `dock-resize`, `dialog-escape` |
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
| Components are unreachable from `node:test`, so a render bug is only ever caught by Playwright | Decorators are not erasable syntax and stripping fails at parse. Logic is extracted into `predicates`, `numeric/format` and `controls/flags`, which are unit tested; the elements stay thin enough that what remains is markup |
| A consumer forgets the write back and the control looks broken | Inherent to a controlled element. Stated first in `docs/fields.md` rather than as a footnote, and the gallery examples all wire it |
| `resize-handle` change breaking existing users | P2 deliberately renames `collapsable`, adds clamping and changes keyboard behavior. It lands first with updated tests and a major changeset |
| Migration diffs too large to review | One editor per phase, one component family per commit |
| `runtime` is published, and P3b adds a dependency to it | `./stats` is DOM free and imported dynamically behind `includePerformanceStats`, so game bundles are unaffected when the flag is off |
| Canvas colours drift from the theme | Tokens resolved through `getComputedStyle` and re-resolved on `theme` and colour scheme changes, asserted in e2e |
| Engine keyboard changes regress game input | Landed as their own commit with their own tests, and the guard only skips events already targeting an editable element |
| UI and viewport shortcuts collide silently | **Unhandled, accepted.** The central registry that would detect this is deferred and unscheduled (SPEC section 9), because no phase registers a binding through it. The design is recorded and ready; the risk stays open until a consumer asks |

