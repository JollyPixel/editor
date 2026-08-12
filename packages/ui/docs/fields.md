# Fields

Shared API for the field controls listed in [controls.md](./controls.md).

## Controlled values

Fields render `value` and emit changes; they do not update `value` themselves. Write emitted
values back to keep a field controlled:

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
| `value` | `T \| typeof Mixed` | Current or mixed value |
| `default` | `T \| undefined` | Revert value |
| `error` | `string \| null` | Validation message |
| `disabled` | `boolean` | Disabled and removed from tab order |
| `readonly` | `boolean` | Focusable but not editable |
| `colored` | `boolean` | Uses the primary accent |
| `lockedBy` | `CollaboratorPresence \| null` | Current lock holder |
| `peers` | `CollaboratorPresence[]` | Visible collaborators |
| `align` | `"start" \| "end"` | Value alignment, default `"start"` |

`value`, `default`, `lockedBy`, and `peers` are properties, not attributes. Use
`align="end"` for numeric or monitor-style rows. Set `colored` when a supported control should
use the primary accent.

## Events

| Event | Detail | When |
|---|---|---|
| `jolly-input` | `{ value }` | Continuous interaction |
| `jolly-change` | `{ value }` | Commit |

Both events bubble, cross shadow boundaries, and are not cancelable. Controls without continuous
interaction emit only `jolly-change`. Reverting emits `jolly-change` with `default`.

## Editing and states

Text controls keep an internal draft. Enter and blur commit it; Escape discards it. An external
`value` update does not replace the visible draft while the field has focus.

Fields can be disabled, readonly, locked, mixed, modified, invalid, or show peers. Their state
attributes are reflected for styling. A locked field remains focusable but cannot be edited;
`disabled`, `readonly`, and `lockedBy` can be combined.

## Mixed values

`Mixed` represents different values across a multi-selection:

```ts
import { Mixed, isMixed } from "@jolly-pixel/ui";

field.value = Mixed;
```

Controls that need a starting value disable those gestures while mixed. Typing and committed
keyboard input can replace it. Use `isMixed()` to test the sentinel.

## Collaboration

`lockedBy` and `peers` accept plain presence objects; the package does not depend on a transport.

```ts
import { peerColor } from "@jolly-pixel/ui";

field.peers = [{ clientId: "a1", displayName: "Ada", color: peerColor(0) }];
field.lockedBy = field.peers[0];
```

## Theming

Fields consume tokens from a scope host with `themeStyles`. Set `--jolly-label-width` to align
labels and `--jolly-field-trailing-width` to reserve a stable trailing column. See
[theming.md](./theming.md).
