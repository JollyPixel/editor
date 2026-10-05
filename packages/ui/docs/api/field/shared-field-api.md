# Shared field API

Text, numeric, choice, color, and vector fields inherit the same row state and
event contract.

The exported types are `FieldValue<T>`, `FieldAlign`, `FieldLabelPosition`,
`FieldDescriptionDisplay`, and `JollyChangeDetail<T>`.

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
| `labelPosition` | `label-position` | `"inline" \| "top" \| "auto"` | `"inline"` |
| `stackBelow` | `stack-below` | `number` | `200` |
| `descriptionDisplay` | `description-display` | `"block" \| "tooltip"` | `"block"` |

`value`, `default`, `lockedBy`, and `peers` must be assigned as JavaScript
properties.

## Label column

The label column holds the label and, while the value differs from `default`,
the revert button. The button sits at the end of the column, flush with the
value, so a modified row keeps the value column of its neighbours: its label
truncates a little sooner instead, and shows its full text on hover. With
`--jolly-label-width` left at `auto`, the column grows by the button's width.

The label column is capped at `--jolly-label-max-width` (`45%`) so a long label
cannot swallow the value area. A field packed next to another on one line is
narrow enough for that cap to truncate its label; set the property to `none`
there. A truncated label shows its full text on hover, see
[overflow titles](../interaction/README.md#overflow-titles).

An empty `label` drops the label column: the field reflects `unlabeled`, and the
value spans the row with the same inset on both edges. The revert button or a
description button then sits just before the value.

`labelPosition="top"` places the label above the value area, with the revert
button on the label line. `"auto"` keeps the label inline while the field is at
least `stackBelow` pixels wide and stacks it below that width, so a field in a
narrow dock or floating window trades height for value width. The field has to
be able to shrink for this to happen; inside a grid, give its track
`minmax(0, 1fr)`. A field with no measured width, such as a hidden one, keeps
its last layout.

While the label sits above the value, through `"top"` or `"auto"`, the field
reflects a `stacked` attribute to style a stacked row by.

## Descriptions

`description` renders as a line of help text below the row by default.
`descriptionDisplay="tooltip"` keeps the row one row tall instead: an
information button opens the label column and shows the description in a
tooltip on hover, keyboard focus, or a tap. Leaving the button or pressing
Escape hides it. The tooltip is a `popover="hint"`, so it leaves other open
popovers, such as a color picker, alone and does not claim the keyboard. An
error always renders below the row.

## Insets and locks

`--jolly-field-inset-end` sets the trailing row inset and defaults to
`--jolly-space-1`. For a field without a label or lock, it also sets the leading
inset. Set it to `0` to align rows with a folder header edge.

`--jolly-field-inset-start` sets the leading row inset, with the same default.
It also drives the indent of the description and error lines. Set both to `0`
where the fields are already inside a padded container, such as a dialog body,
so rows, separators and descriptions share one left edge.

A lock only paints: the row takes the holder's colour as a left bar and a tint,
and hovering it shows "Held by" and the holder's name. The label, the value and
the row height stay where they were, per [ADR-0018](../../adr/0018-locks-are-advisory.md).
Peer chips sit on the row's top corner, above the value, and are left out while
the field is locked, since the tint already names the holder.

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
