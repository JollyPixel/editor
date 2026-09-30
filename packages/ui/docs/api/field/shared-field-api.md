# Shared field API

Text, numeric, choice, color, and vector fields inherit the same row state and
event contract.

The exported types are `FieldValue<T>`, `FieldAlign`, `FieldLabelPosition`,
and `JollyChangeDetail<T>`.

## Properties

| Property | Attribute | Type | Default |
|---|---|---|---|
| `label` | `label` | `string` | `""` |
| `description` | `description` | `string` | `""` |
| `value` | none | `T \| typeof Mixed` | Component-specific |
| `default` | none | `T \| undefined` | `undefined` |
| `error` | `error` | `string \| null` | `null` |
| `disabled` | `disabled` | `boolean` | `false` |
| `readonly` | `readonly` | `boolean` | `false` |
| `colored` | `colored` | `boolean` | `false` |
| `lockedBy` | none | `CollaboratorPresence \| null` | `null` |
| `peers` | none | `CollaboratorPresence[]` | `[]` |
| `path` | `path` | `string \| null` | `null` |
| `align` | `align` | `"start" \| "end"` | `"start"` |
| `labelPosition` | `label-position` | `"inline" \| "top"` | `"inline"` |

`value`, `default`, `lockedBy`, and `peers` must be assigned as JavaScript
properties. `labelPosition="top"` places the label above the value area.

`--jolly-field-inset-end` sets the trailing row inset and defaults to
`--jolly-space-1`. For a field without a label or lock, it also sets the leading
inset. Set it to `0` to align rows with a folder header edge.

`--jolly-field-inset-start` sets the leading row inset, with the same default.
It also drives the indent of the description and error lines. Set both to `0`
where the fields are already inside a padded container, such as a dialog body,
so rows, separators and descriptions share one left edge.

An empty `label` drops the label column: the field reflects `unlabeled`, and the
value spans the row with the same inset on both edges.

A lock only paints: the row takes the holder's colour as a left bar and a tint,
and hovering it shows "Held by" and the holder's name. The label, the value and
the row height stay where they were, per [ADR-0044](../../adr/0044-a-lock-paints-and-never-reflows.md).
Peer chips sit on the row's top corner, above the value, and are left out while
the field is locked, since the tint already names the holder.

The label column is capped at `--jolly-label-max-width` (`45%`) so a long label
cannot swallow the value area. A field packed next to another on one line is
narrow enough for that cap to truncate its label; set the property to `none`
there.

## Events

| Event | Detail | Timing |
|---|---|---|
| `jolly-input` | `{ value }` | Continuous interaction |
| `jolly-change` | `{ value }` | Committed value |

Both events bubble, cross shadow boundaries, and are not cancelable. A field
with no continuous gesture may emit only `jolly-change`.

## Mixed values

`Mixed` is the exported sentinel for a multi-selection without one value.
`isMixed(value)` narrows it. Fields render a mixed state and keep `value`
unchanged until an allowed edit commits a concrete value.

## Collaboration

`CollaboratorPresence` has `clientId`, `displayName`, `color`, and optional
`editing` fields. `lockedBy` makes the field read-only while keeping it
focusable. `peers` renders collaborator indicators, except for the local peer
of the attached source. The package owns no
collaboration transport.

`path` is the identity the field claims while focused, agreed between clients
and supplied by the consumer. It defaults to `null`, which opts the field out of
locking entirely.

A field with a `path` under a pane carrying a [`PresenceSource`](../peer/presence-source.md)
has `lockedBy` and `peers` written for it: it claims on focus, releases on blur
and on disconnection, and never locks against itself. Without a source both stay
consumer owned, like every other property here.
