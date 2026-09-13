# Thermo-nuclear code quality review

Reviewed 13 September 2026 on branch `refactor-ui-v2` at `14ef4902`, including
the current working tree. The audit covered the 179 TypeScript files under
`src/` (24,105 lines), the public export surface, the package ADRs, and tests
where they clarify ownership. This is an architecture and duplication review,
not a behavioral correctness review.

## Verdict

The package has several good foundations: DOM-free tree and layout functions,
one pointer-session primitive, structural math types, and explicit ADRs. It
does not pass the thermo-nuclear maintainability bar yet. Two architecture
problems should block further feature growth in their areas:

1. `DockLayout` stores layout in the DOM, `#snapshot`, and `#geometry`, then
   repeatedly translates among all three.
2. `StatsElement` knows the IDs of built-in metrics, directly contradicting
   ADR-0016's public-contract boundary.

The next tier of debt is concentrated rather than pervasive. Numeric text
editing has three owners, persistence has a thin controller surrounded by
caller-specific policy, and the facade repeats the same item shell seven
times. Fixing those seams would remove more code than a local cleanup pass.

## Findings

### TN-01: `DockLayout` has three sources of truth

**Severity: high**

`src/containers/DockLayout.ts` is 815 lines with 26 private members and 38
`if` branches. Its size is the symptom. The structural problem is that layout
state exists in three mutable forms:

- `#snapshot` and `#geometry` at
  `src/containers/DockLayout.ts:85-92`;
- dock, floating, and pane placement in the live DOM;
- the authored layout captured by `#readDeclared()` at
  `src/containers/DockLayout.ts:665`.

Startup and reset project snapshots into the DOM through `#apply()`
(`src/containers/DockLayout.ts:559`). Pointer and keyboard operations take the
opposite route: `#dockPane()` and `#extract()` mutate the DOM, then `#refresh()`
calls `#read()` to reconstruct `#snapshot` (`src/containers/DockLayout.ts:442`,
`:476`, and `:700-768`). Floating geometry is copied into a side cache during
that reconstruction. The 129-line `#onPaneDrag()` method also owns gesture
configuration, preview behavior, DOM movement, persistence, and cleanup
(`src/containers/DockLayout.ts:209-337`).

This design makes every new layout property pay for at least three mappings.
It also makes correctness depend on mutation order: a slot-change callback can
reconcile the old snapshot over a DOM move unless `#refresh()` runs first, as
the comment at lines 757-764 explains. That comment documents a race created
by the ownership model.

**Recommended restructuring**

Make `LayoutSnapshot` the only mutable layout state. Add pure operations in the
layout model for pane moves, extraction, geometry changes, collapse, and folder
state. Pointer and keyboard handlers should produce one state transition and
then call one DOM projector. Child components can report typed changes without
forcing the layout to reread their entire subtree.

A safe sequence is:

1. Extract `readDeclared`, `readCurrent`, and `apply` into one
   `LayoutProjection` module so all DOM-to-model mapping has one owner.
2. Add pure `movePane` and `floatPane` functions beside reconciliation in
   `src/containers/layout.ts`.
3. Route pointer and keyboard commits through those functions. Delete
   `#refresh()` once committed operations no longer use the DOM as a write
   model.
4. Move drag-session assembly into a `DockLayoutDragController`. The element
   should retain lifecycle and event wiring, not the full gesture policy.

The target is not merely a smaller class. One user action should have one
state transition, one projection, and one save.

### TN-02: built-in metric IDs leak into the generic stats component

**Severity: high**

ADR-0016 says built-in metrics carry no privilege and must use the same
`MetricDefinition` contract as consumer metrics. The contract has range,
direction, aggregation, formatting, and sampling fields
(`src/stats/MetricDefinition.ts:6-24`). It has no presentation metadata.

`StatsElement` works around that missing contract by declaring built-in-only
color slots (`src/stats/Stats.ts:33-46`), resolving four pairs of built-in CSS
tokens (`src/stats/Stats.ts:313-370`), and branching on the literal IDs `fps`,
`ms`, `worstMs`, and `mb` in `#palette()`
(`src/stats/Stats.ts:512-552`). The same IDs also appear in
`src/stats/Stats.styles.ts:16-23`.

Custom metrics therefore travel through the public recorder API but cannot use
the same palette path as built-ins. The renderer has acquired knowledge that
belongs in metric registration. Adding another built-in now requires edits to
the definition file, component logic, and component CSS.

**Recommended restructuring**

Put optional palette metadata on `MetricDefinition`, using values that can
refer to CSS custom properties. Define the built-in palettes in
`src/stats/builtins.ts` through that public field. `StatsElement.#palette()` can
then resolve `definition.palette` or derive a semantic fallback from `better`.
All ID branches and the built-in fields in `StatsColors` disappear.

Because `MetricDefinition` is public, update the API documentation. ADR-0016
does not need replacement if the change restores its stated decision.

### TN-03: numeric editing has three competing implementations

**Severity: high**

`DraftController` says it owns the common input, keyboard, blur, and parse
lifecycle (`src/field/DraftController.ts:11-109`). That ownership holds only
for single-value fields. `AxisController` recreates draft text, parse error,
input handling, Enter/Escape behavior, arrow stepping, blur commit, and
quantization (`src/math/AxisController.ts:55-60` and `:124-223`). `Range` has a
third copy for two keyed drafts (`src/controls/Range.ts:47-51` and `:127-250`).

The numeric controls also repeat policy around `parseNumeric()`, `quantize()`,
`multiplierFor()`, and `valueFromDelta()`:

- `NumberField`: `src/controls/Number.ts:121-195`;
- `Range`: `src/controls/Range.ts:127-249`;
- `AxisController`: `src/math/AxisController.ts:136-216`;
- `Slider` repeats the parse-and-quantize commit at
  `src/controls/Slider.ts:158-177`.

This is already causing divergence. `NumberField` and `Range` use
`PointerFocusController`; axis inputs do not. `JollyField` exposes external and
parse errors through one `displayError`, while `AxisController` maintains its
own private error that cannot use the field's error presentation. A keyboard or
accessibility fix now needs separate patches.

There is matching visual duplication. The scrub-handle rules in
`src/controls/Number.styles.ts:25-53` and
`src/math/VectorField.styles.ts:82-111` are nearly identical.

**Recommended restructuring**

Create a `NumericInputController` that composes the existing
`DraftController`, owns numeric parsing, quantization, modifier-scaled arrow
steps, and optional scrubbing, and accepts a final domain coercion callback.
Keep markup in each component. `Range` can instantiate one controller per end
and use its coercion callback to prevent endpoint crossing. `AxisController`,
`NumberField`, and the slider readout can use the same lifecycle without
becoming the same component.

Move the scrub-handle CSS into an interaction-owned style fragment, beside
`ScrubController`, and include it from number and vector styles.

### TN-04: persistence policy is duplicated around a thin controller

**Severity: medium**

`PersistedState` registers as a Lit controller, but its only lifecycle method
is an empty `hostConnected()` (`src/storage/PersistedState.ts:12-29`). Its real
job is two-way routing between a storage adapter and a managed layout. It does
not own codecs, defaults, namespace construction, or restoration.

The missing policy is repeated by callers:

- four components repeat the same `new PersistedState(...)` setup
  (`Dock.ts:111`, `Floating.ts:100`, `Folder.ts:73`, and `Pane.ts:125`);
- five container classes define their own `#namespace()` method;
- dock, floating, pane, and folder each parse booleans or numbers and write
  strings in private restore/persist methods;
- `ThemePreferences` and `StatsElement` bypass `PersistedState` and implement
  suffixing and restoration directly.

Eight source sites also construct their own `LocalStorageAdapter`. Each adapter
owns a separate `MemoryStorageAdapter` fallback
(`src/storage/LocalStorageAdapter.ts:30-32`). When `localStorage` is unavailable,
the default fallback is isolated to one element instance; recreating an element
with the same key does not see the earlier value.

**Recommended restructuring**

Choose one honest abstraction:

- A real persisted-property controller should own typed codecs, default-value
  handling, namespace construction, managed-layout routing, and restoration at
  the correct lifecycle point.
- If lifecycle is intentionally caller-owned, remove `ReactiveController` and
  `host.addController(this)`. Keep a plain namespaced store with `boolean`,
  `number`, and JSON codecs.

Provide the default adapter through one package-level resolver with a clearly
defined lifetime. Tests should cover replacement of an element after storage
failure, not only repeated calls on one adapter.

### TN-05: the facade repeats its item shell seven times

**Severity: medium**

`hidden` accessors appear in seven facade classes. Six also repeat `disabled`,
and six repeat `dispose()`. Examples include:

- `src/facade/Binding.ts:89-107` and `:125-127`;
- `src/facade/Button.ts:24-42` and `:53-55`;
- `src/facade/Monitor.ts:66-84` and `:93-95`;
- `src/facade/Presence.ts:78-100`;
- almost all of `src/facade/Separator.ts:3-35`.

`FacadeContainer` contains another copy at
`src/facade/Container.ts:140-162`. The implementations have already drifted:
some write an element's `disabled` property, while others toggle an attribute.
That difference may be required for each element, but the lifecycle and hidden
behavior are identical.

**Recommended restructuring**

Introduce a small `FacadeItem<TElement extends HTMLElement>` base that owns
`element`, `hidden`, and `dispose`. Give it a protected disabled read/write hook
or a capability interface so native-property and attribute-backed elements are
explicit. `FacadeContainer`, `Binding`, `Button`, `Monitor`, `Presence`, and
`Separator` can keep their public classes while sharing the shell.

Do not replace the facade with a generic proxy. ADR-0001 makes the facade a
public constructor layer; a typed base removes duplication without weakening
that boundary.

### TN-06: event dispatch is copied across domain folders

**Severity: medium**

`emitContainerEvent`, `emitDataEvent`, and `emitPeerEvent` contain the same
`CustomEvent` construction and dispatch code:

- `src/containers/events.ts:50-62`;
- `src/data/tree/contract.ts:76-89`;
- `src/peer/events.ts:9-21`.

`emitFieldEvent` differs only because it wraps a value in `{ value }`
(`src/field/events.ts:32-48`). Receivers then repeatedly call the unchecked
generic cast in `detailOf<TDetail>()` (`src/dom.ts:37-41`). The event maps are
useful domain contracts; event construction is not domain logic.

**Recommended restructuring**

Add one internal `emitComposedEvent<TDetail>()` primitive in an event utility
module. Keep `ContainerEventMap`, `DataEventMap`, and `PeerEventMap` beside their
owners, with thin typed calls if naming helps discovery. Field events can pass
their `{ value }` shape to the same primitive. Add specific detail guards only
at boundaries that can receive events from consumer code; renaming
`detailOf<T>()` as a validator would be misleading because it performs no
validation.

### TN-07: numeric precision logic is duplicated verbatim

**Severity: medium**

`decimalPlaces()` is duplicated in `src/numeric/format.ts:67-86` and
`src/numeric/valueFromDelta.ts:84-103`. Both copies include the same scientific
notation branch. Formatting, quantization, and delta stepping can disagree if
only one copy is fixed.

Extract a package-private `decimalPlaces()` and `roundToPrecision()` into a
numeric precision module. `formatNumber`, `quantize`, and `valueFromDelta`
should use it. Preserve tests for finite values, `e-` notation, large
precision, and the 12-decimal cap.

### TN-08: two visual primitives are maintained as copied CSS

**Severity: low**

The scrub-handle duplication belongs with TN-03. A second exact block styles
thin scrollbars in `src/containers/Dock.styles.ts:96-110` and
`src/containers/Pane.styles.ts:173-187`. These are shared visual primitives,
not component policy.

Move the scrollbar block to `src/theme/styles/mixins.ts` and the scrub handle
to the scrub interaction area. Keep component-specific overflow and padding at
the call sites.

## Decomposition watchlist

No source file crosses 1,000 lines. Four components are close enough that new
behavior should require decomposition first:

| File | Lines | Assessment |
| --- | ---: | --- |
| `src/containers/DockLayout.ts` | 815 | Block new behavior until TN-01 is addressed. |
| `src/data/tree/Tree.ts` | 762 | Large, but its structural model and key policy are already extracted under ADR-0032. Extract another owner only when a concrete interaction grows. |
| `src/stats/Stats.ts` | 586 | Palette extraction from TN-02 should reduce both size and branching. Canvas drawing could then move to a plain renderer if it grows again. |
| `src/controls/ColorPicker.ts` | 583 | Cohesive today. Watch its 27 private members; avoid adding another color mode directly to this class. |

`Dock.ts` (546), `Pane.ts` (484), and `Floating.ts` (479) will also shrink if
persistence and layout projection move to canonical owners.

## Similarities that should stay separate

Some repeated shapes do not justify a shared abstraction:

- `Rail` and `Toolbar` both expose orientation, but a toolbar owns ARIA toolbar
  semantics while a rail is layout chrome. Sharing a base would save little and
  blur their contracts.
- `ThemeControl` and `DensityControl` have matching relay code, but they compose
  different field primitives and are short. The shared event primitive from
  TN-06 is enough.
- Small `Math.min(Math.max(...))` expressions express local bounds. A global
  `clamp()` utility would add indirection unless rounding or unit policy travels
  with it.

## Recommended order

1. Fix TN-02. It is a contained public-contract repair and removes an ADR
   violation.
2. Design TN-01 as a state-ownership change and record a superseding ADR only
   if the chosen model changes ADR-0022's persistence boundary.
3. Build the numeric controller from TN-03, then migrate one control at a time
   with deterministic unit and E2E coverage.
4. Consolidate persistence and the facade shell. These changes touch public
   types, so use `tstyche` coverage where assignability matters.
5. Fold in the event, precision, and CSS utilities while their callers are
   already changing.

The package should be considered ready for another architecture review when
layout actions no longer round-trip through the DOM, metric rendering contains
no built-in IDs, and every numeric text input uses one draft-and-commit policy.
