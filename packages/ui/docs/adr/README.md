# Architecture Decision Records

Decisions behind `@jolly-pixel/ui` that are hard to reverse, surprising without context, or the
result of a real trade-off. API reference lives in [`docs/api`](../api), usage in
[`docs/guides`](../guides).

| # | Decision |
|---|---|
| [0001](./0001-elements-are-the-public-api.md) | Custom elements are the public API, the facade only constructs them |
| [0002](./0002-controlled-elements.md) | Controlled elements, stateful facade |
| [0003](./0003-field-base-class.md) | One shared field contract on a base class, not a mixin or controller |
| [0004](./0004-mixed-sentinel.md) | `Symbol.for` for the `Mixed` sentinel |
| [0005](./0005-field-state-combines.md) | `disabled`, `readonly` and `lockedBy` combine rather than override |
| [0006](./0006-expression-grammar.md) | Expressions parsed by a closed grammar, never `eval` |
| [0007](./0007-tokens-on-scope-hosts.md) | Tokens are declared once on scope hosts, using `light-dark()` |
| [0008](./0008-two-token-tiers.md) | Two token tiers: private ramps, public semantics |
| [0009](./0009-alpha-ink-control-backgrounds.md) | Control backgrounds are alpha stops of one ink |
| [0010](./0010-non-text-contrast-waiver.md) | Non-text contrast is deliberately not met for control boundaries |
| [0011](./0011-inlined-font.md) | Roboto Mono is inlined as a base64 data URI, one weight |
| [0012](./0012-placement-separate-from-content.md) | Placement is separate from content |
| [0013](./0013-resize-geometry-stays-in-resize-handle.md) | Resize geometry stays in `@jolly-pixel/resize-handle` |
| [0014](./0014-color-control-drops-native-input.md) | `jolly-color` drops `input[type="color"]` |
| [0015](./0015-stats-measurement-separate-from-display.md) | Measurement is separate from display, and `./stats` is DOM-free |
| [0016](./0016-built-ins-carry-no-privilege.md) | Built-in metrics and icons carry no privilege over registered ones |
| [0017](./0017-presence-port.md) | `ui` declares a presence port and owns the presence schema |
| [0018](./0018-locks-are-advisory.md) | Locks are advisory, and live in the holder's presence |
| [0019](./0019-lock-paths-are-consumer-supplied.md) | Lock paths are consumer-supplied, never derived |
| [0020](./0020-input-scope-follows-focus.md) | Input scope follows focus, and is fixed in both `engine` and `ui` |
| [0021](./0021-structural-math-types.md) | Structural math types, no `three` dependency |
| [0022](./0022-persistence-keys-and-reconciliation.md) | Layout persists through derived keys and a stated reconciliation algorithm |
| [0023](./0023-field-events-are-not-cancelable.md) | Field events are not cancelable, and carry the value alone |
| [0024](./0024-no-spec-imports-a-component.md) | No spec imports a component, so testable logic lives in plain modules |
| [0025](./0025-package-boundaries.md) | Lit is a peer dependency and the barrel is never side-effect-free |
| [0026](./0026-shortcut-registry.md) | A central shortcut registry (proposed, unscheduled) |
| [0027](./0027-facade-math-writes-are-component-wise.md) | The facade writes a math value component-wise, and refreshes from a snapshot |

## Scope boundary

`ui` owns anything expressible without knowing what a voxel, a layer or an asset is. Domain-coupled
composites stay in editors and are built from these parts. Asset and object reference pickers, block
and tileset libraries, 3D preview tiles, and curve and gradient editors are out of scope.

`jolly-split`, `jolly-menu` and `jolly-toast` are deferred rather than rejected: no consumer in this
repository names one, so there is nothing to validate a design against.

## Open questions

- Whether `jolly-tree` virtualizes. Deferred until a consumer exceeds a few hundred nodes.
- Whether pane state beyond order persists through Tweakpane-style `exportState` / `importState`.
  Not built: no consumer to validate a serialisation format against.
- Whether user-rebindable shortcuts are needed, and where overrides persist. See ADR-0026.
- Whether `jolly-flags` needs per-bit mixedness. A bitmask across a multi-selection genuinely is
  mixed bit by bit, which `FieldValue<number>` cannot express.
- Relative multi-edit is not expressible. `{ value: T }` carries one absolute value; Unity applies a
  delta to each selected object instead, which would need a second detail shape and write-back path.
- Whether `JollyField` becomes public. Promoting it is additive (ADR-0003).
