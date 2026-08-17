# @jolly-pixel/ui implementation plan

Steps for [SPEC.md](./SPEC.md). Each phase lists creates, tests, deletions, and its completion
gate. From P2 onward every phase retires code; components ship with `X.ts`, `X.styles.ts`, and
documentation in the same commit.

P0–P4 are done and summarized below rather than kept in full step-by-step form. P5 onward is
what's next and stays fully detailed.

## Done: P0–P4

**P0 — foundation.** Theme (`ramps`/`tokens`/`density`/`scales`/`peerColor`), `Mixed`/`FieldValue`,
`StorageAdapter` (+ Local/Memory adapters), `numeric/valueFromDelta`, `numeric/evaluate`, the
gallery harness (manifest-driven routing, `chrome=off`, `__galleryReady`), and the `engine`
keyboard fix (`isEditableTarget`, Tab/Escape no longer trapped) that made the UI keyboard
reachable. `Mixed` uses `Symbol.for` (not `Symbol()`) so the sentinel survives a duplicate `lit`
copy — that's the one gotcha worth remembering if a new sentinel type is ever added. Contrast is
not asserted in code (see SPEC section 4).

**P1 — controls.** `JollyField<T>` base class implements the full state channel table once
(focus, lock, error, revert, `Mixed`, peers, hover/active, disabled) so no control repeats it.
Twelve controls under `src/controls/`: `Button`, `ButtonGroup`, `Checkbox`, `Number`, `Slider`,
`Range`, `Text`, `Select`, `Flags`, `Color`, `Separator`, `PropertyRow`. `ScrubController` for
drag scrub, `icon/registry` + `icon/builtins` + `Icon`. Numeric helpers live under `src/numeric/`
(expression parsing, formatting/quantisation, scrub delta) since they're one feature shared by
`Number`, `Range`, and `ScrubController`.

**P2 — containers and chrome.** `src/containers/`: `Pane`, `Folder`, `Tabs`, `Tab`, `Dock`,
`Floating`, `Dialog`, `Toolbar`, `Rail`. `Pane` and `Dialog` are theme scope hosts. `resize-handle`
gained supplied handles, numeric bounds, a pure clamped `sizeFromDelta`, keyboard-resizable ARIA
separators, `dispose()`, and the `collapsable`→`collapsible` rename (accepted breaking change,
major version). `src/geometry/clampToViewport.ts` backs `Floating`'s viewport clamping. Gallery
shell now runs on `jolly-dock` + reorderable `Pane` + `Folder` groups.

**P2b — colour picker.** `src/color/` (`parse`, `format`, `hsv`, `area` — dependency-free, shaped
to lift into a future `@jolly-pixel/color` package), `PopoverController` (placement, reposition,
focus restore, `onCancel`), `ColorPicker`. `Color` control rewritten onto the popover, native
`input[type="color"]` retired. `vanilla-picker` in `editors/pixel-art` is intentionally still
alive — that retirement is P8's job, not an oversight.

**P3 — facade, end of Tweakpane.** `src/facade/`: `Pane`, `Folder`, `Binding`, `Monitor`, `Button`,
`Separator`, `dispatch.ts` (value/options → element). `src/monitors/`: `Monitor`, `Graph`,
`format.ts`. `packages/three` and `packages/voxel.renderer` example/demo files migrated off
`tweakpane` onto the facade; both packages' `tweakpane`/`@tweakpane/core` deps removed.
`exportState`/`importState` deliberately not built (no consumer yet — SPEC section 16).

**P3b — stats.** `src/stats/`: `StatsRecorder` (`begin`/`end`/`track`/`addMetric`/`snapshot`/
`history`/`subscribe`), `MetricDefinition`, builtins (`fps`, `ms`, `worstMs`, `mb`), `jolly-stats`.
Exposed via the `./stats` subpath (DOM-free, no Lit — importable without pulling the element
barrel). `Runtime.ts`'s `includePerformanceStats` widened to `boolean | { mount?: boolean }`.
`stats.js` and every remaining `tweakpane`/`@tweakpane/core` import (including `voxel-map`'s
`PerformanceHUD.ts`, the last holdout) are gone from the repo.

**P4 — math components.** `src/math/`: `Vector2`, `Vector3`, `Vector4`, `Quaternion`, `Transform`,
`Point2d`, plus `euler.ts` and `equals.ts`. Axis chips reuse P1's drag scrub; `Mixed` applies per
axis. Landed on `origin/ui-math-components` (commit `067fb96`) — rebase/merge into this branch
before starting P5 if it isn't in `src/math/` yet.

Barrel (`src/index.ts`) exports theme tokens, `Mixed`/`FieldValue`/`isMixed`, `StorageAdapter`,
the twelve P1 controls plus `JollyOption`/`Interval`/`JollyChangeDetail`/`CollaboratorPresence`/
`registerIcon`/`IconName`, the nine P2 containers (`PaneElement` for the element constructor),
`ColorPicker`/`PopoverController`/`parseColor`/`formatHex`/`RGBA`, the six facade classes,
`Monitor`/`Graph`, and the six P4 math elements. `./stats` and `./network` are separate subpaths
(P3b, P7). Internal-only: `evaluate`, `deriveKey`, `resolveOrder`, `valueFromDelta`, `JollyField`,
`ScrubController`, `dispatch.ts`, `anchoredPosition`, and the rest of `src/color/`.

**Deferred out of P0–P4, still not built**: `input/ShortcutRegistry.ts`/`matchBinding.ts`
(unscheduled — SPEC section 16), `input/InputScope.ts`/`FocusScopeTracker.ts` (→ P6, lands with
its consumer), `jolly-split` (no consumer defines its sizing contract yet).

## P5: `jolly-tree`, and voxel-model

`Progress` shipped ahead of this phase under `src/feedback/`, together with the runtime loading
screen that supplied its first consumer and gallery fixture.

**Create** under `src/data/`: `Tree`. Its reparent-zone resolution, keyboard navigation and
multi-select algorithms port from `packages/arbor`'s `TreeView`/`TreeViewSelector`, which already
implement this against hand-built DOM nodes for voxel-model's `RightPanel`. `List` and `Search`
move to P6, where their only named consumers actually are. `Menu` and `Toast` are dropped from
the plan entirely — see SPEC section 5.

`arbor` does **not** retire in this phase: `editors/voxel-map`'s `LayerManager.ts` also imports
`TreeView` from it directly, a second consumer P5's own scope check missed until implementation.
Retirement moves to P6, alongside `LayerManager`'s own migration onto `jolly-tree`. This phase only
drops voxel-model's dependency on the package.

`Tree` takes generic nodes (`{ id, label, children }`, generic over a `data` payload the same way
`TransformLike` is structural rather than closed), supports drag and drop reparenting with above,
below and inside drop zones, collapsible groups, and visibility plus lock toggles. It knows
nothing about scenes. It is fully controlled: `selected` and `expanded` are consumer owned, same
as `value` elsewhere in this package, so remote or programmatic changes repaint it the same way a
local edit does. A drop emits raw intent (`jolly-reparent` with `{ movedIds, targetId, where }`)
rather than a computed result, so a consumer can veto a domain specific reparent — nesting a mesh
inside a group it already contains, say — before applying one. A pure exported
`resolveReparent(nodes, movedIds, targetId, where)` computes the common case for a consumer that
has no veto to apply. The structural invariant that a node cannot be dropped into itself or its
own descendant is enforced inside the component, ported from `arbor`'s dragover guard; that is
not a domain rule, so it does not wait for the consumer to enforce it. Domain vetoes stay the
consumer's job.

**Migrate** `editors/voxel-model`: `LeftPanel` onto `jolly-tabs` (its mode switcher is one
horizontal row of three, which is what `jolly-tabs` already is — `jolly-rail` doesn't have a
match anywhere in `LeftPanel`'s actual markup, correcting this bullet's original wording),
`RightPanel` onto `jolly-tree` plus `jolly-toolbar` for its Add Cube / Duplicate row,
`PopupManager` and `AddMeshPopup` onto `jolly-dialog`'s `showPrompt()`. The migration is as-is,
not a cleanup:
`LeftPanel`'s `animate` tab ships as a `disabled` `jolly-tab` despite there being no
`tabs/Animate.ts` behind it, and `Duplicate` stays a button with no handler. `showPrompt()` has no
hook for `PopupManager`'s `sceneManager.setControlsEnabled(false/true)` around the popup's
lifecycle, so the migration wraps it locally to preserve that behavior — a thin, throwaway shim
until P6's `InputScope` work makes it unnecessary.

`tabs/Build.ts` and `tabs/Paint.ts` onto P1 and P4 controls is out of scope for this pass.
`Build.ts`'s axis inputs, unwrap mode select and flip buttons are currently unwired decoration;
`Paint.ts`'s color/opacity/size row is functional. Migrating both onto native-replacing controls
is different enough work from a data-view migration that it gets its own pass.

**Deletes**: `PopupManager.ts`, `components/popups/` (`AddMeshPopup.ts` folds into `showPrompt()`),
and the hardcoded palettes across the migrated components. `packages/arbor` itself stays until P6
— see above.

**Tests**: unit for `resolveReparent`, which is pure given a node list, the moved ids and a drop
target. E2e for dragging a node onto, above and below another.

**Done when**: `RightPanel`, `LeftPanel` and the mesh creation dialog render from
`@jolly-pixel/ui`, respond to the `theme` attribute, and declare no component local colors.

## P6: voxel-map

**Create** under `src/data/`: `List` (add, remove, reorder, inline rename) and `Search`, moved
from P5 to land beside their actual consumers — `List` replaces three hand-built copies
(`ObjectLayerPanel`, `TilesetManager`, `LayerPanel`); `Search` is new functionality for
`BlockLibrary`, which has no filter UI today to migrate from.

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
| P5 | 1 data view (tree) | `tree-reparent` |
| P6 | 2 data views (list, search) | `input-scope` |
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

