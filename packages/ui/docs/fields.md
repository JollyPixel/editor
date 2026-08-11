# Fields

Shared API for the field controls listed in [controls.md](./controls.md).

## Controlled values

Fields render `value` and emit changes; they do not update `value` themselves. Write the emitted
value back to keep the control controlled.

```ts
const field = document.createElement("jolly-number");
field.value = 0.5;
field.addEventListener("jolly-change", (event) => {
  field.value = event.detail.value;
});
```

## Properties

| Property | Type | Description |
|---|---|---|
| `label` | `string` | Row label |
| `description` | `string` | Help text |
| `value` | `T \| typeof Mixed` | Current value or mixed value |
| `default` | `T \| undefined` | Value used by the revert affordance |
| `error` | `string \| null` | Consumer-provided validation message |
| `disabled` | `boolean` | Disables and removes from tab order |
| `readonly` | `boolean` | Prevents editing while remaining focusable |
| `lockedBy` | `CollaboratorPresence \| null` | Collaborator holding the field |
| `peers` | `CollaboratorPresence[]` | Collaborators shown on the field |
| `align` | `"start" \| "end"` | Which edge the value sits against, default `"start"` |

Set `align="end"` on numeric and monitor-style rows, where trailing alignment lines the digits up
down the pane:

```html
<jolly-number label="Position X" align="end"></jolly-number>
```

`value`, `default`, `lockedBy` and `peers` are properties, not attributes.

## Events

| Event | Detail | When |
|---|---|---|
| `jolly-input` | `{ value }` | During continuous interaction |
| `jolly-change` | `{ value }` | On commit |

Both events bubble and cross shadow boundaries. They are not cancelable. Controls without a
continuous interaction emit only `jolly-change`; see [controls.md](./controls.md) for details.

Reverting also emits `jolly-change` with `default`.

## Editing

Text controls keep an internal draft while editing:

- `Enter` commits.
- `Escape` discards the draft.
- `Blur` commits.

While focused, the draft remains visible when an external `value` changes.

## States

Fields can combine these states:

| State | Representation |
|---|---|
| `disabled` | Disabled, not focusable |
| `readonly` | Focusable but not editable |
| `locked` | Focusable, not editable, with collaborator indicator |
| `mixed` | Dash placeholder or indeterminate state |
| `modified` | Leading bar, with an always-visible muted revert affordance |
| `invalid` | Error tint and message |
| `peers` | Collaborator chips |

`disabled`, `readonly`, `locked`, `mixed`, `modified` and `invalid` are reflected attributes for
styling. `disabled`, `readonly` and `lockedBy` can be combined.

## Mixed values

`Mixed` represents different values across a multi-selection.

```ts
import { Mixed, isMixed } from "@jolly-pixel/ui";

field.value = Mixed;
```

Gestures that require a starting value are unavailable while mixed. Typing and committed keyboard
input can still replace the mixed value. `isMixed()` tests for the sentinel.

## Collaboration

`lockedBy` and `peers` accept plain presence objects; the package does not depend on a transport.

```ts
import { peerColor } from "@jolly-pixel/ui";

field.peers = [
  { clientId: "a1", displayName: "Ada", color: peerColor(0) }
];
field.lockedBy = field.peers[0];
```

## Theming

Fields consume tokens from a scope host that includes `themeStyles`. Set `--jolly-label-width` on
an ancestor to align labels:

```css
.pane { --jolly-label-width: 8ch; }
```

Set `--jolly-field-trailing-width` when stacked fields need the same value edge despite optional
revert and presence chrome:

```css
.pane { --jolly-field-trailing-width: 48px; }
```

See [theming.md](./theming.md).
