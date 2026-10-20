# Shared field API

Text, numeric, choice, colour and vector fields share this row state and event
contract.

## Properties

```ts
interface JollyField<T> {
  label: string;
  description: string;
  value: T | typeof Mixed; // property only, default per component
  default: T | undefined; // property only, shows a revert button when differs
  error: string | null;
  disabled: boolean;
  readonly: boolean;
  colored: boolean; // active parts use the accent fill
  lockedBy: CollaboratorPresence | null; // property only
  peers: readonly CollaboratorPresence[]; // property only
  path: string | null; // lock identity, null opts out
  align: "start" | "end"; // default "start"
  labelPosition: "inline" | "top" | "auto"; // attribute label-position
  stackBelow: number; // attribute stack-below, default 200
  descriptionDisplay: "block" | "tooltip"; // attribute description-display
}
```

Exported types: `FieldValue<T>`, `FieldAlign`, `FieldLabelPosition`,
`FieldDescriptionDisplay`, `JollyChangeDetail<T>`.

## Events

```ts
interface FieldEvents<T> {
  "jolly-input": { value: T; }; // continuous interaction
  "jolly-change": { value: T; }; // committed value
}
```

- Both bubble, cross shadow boundaries and are not cancelable.
- A field with no continuous gesture may emit only `jolly-change`.

## Mixed values

`Mixed` stands for a multi-selection without one value, and `isMixed(value)`
narrows it. A field shows a mixed state and keeps `value` until an edit
commits a concrete value.

## Label column

- The column holds the label and, while `value` differs from `default`, the
  revert button. The label truncates to make room, with an
  [overflow title](../interaction/overflow-titles.md).
- `--jolly-label-width` sets the column width. At `auto`, it grows by the
  button's width.
- `--jolly-label-max-width` caps it (`45%`). Set it to `none` for a field
  packed next to another on one line.
- An empty `label` drops the column and reflects `unlabeled`.

## Label position

- `"top"` puts the label above the value, with the revert button on the label
  line.
- `"auto"` stacks the label while the field is narrower than `stackBelow`
  pixels. The field must be able to shrink: in a grid, use `minmax(0, 1fr)`.
- A field with no measured width, such as a hidden one, keeps its last layout.
- A stacked field reflects `stacked`.

## Descriptions

- `"block"` shows the description as help text below the row.
- `"tooltip"` keeps the row one line tall: an information button shows the
  description on hover, focus or tap. Escape hides it. It does not close other
  popovers or claim the keyboard.
- An error always shows below the row.

## Insets

- `--jolly-field-inset-start` and `--jolly-field-inset-end` set the row insets,
  default `--jolly-space-1`. The start inset also indents description and
  error lines. `jolly-property-row` and a `jolly-separator` caption follow the
  same insets, so they stay aligned with the labels.
- Set both to `0` inside a padded container, such as a dialog body.
- Set the end inset to `0` to align rows with a folder header edge.

## Collaboration

```ts
interface CollaboratorPresence {
  clientId: string;
  displayName: string;
  color: string;
  editing?: string; // field path being edited
}
```

- `lockedBy` makes the field read-only and keeps it focusable. The row shows
  the holder's colour as a left bar and tint, and "Held by" on hover. The
  layout does not change.
- `peers` shows collaborator chips at the end of the label cell, except the
  local peer. Chips are hidden while locked.
- `path` is the identity the field claims while focused, agreed between
  clients. Under a pane with a [`PresenceSource`](../peer/presence-source.md),
  `lockedBy` and `peers` are written for the field: it claims on focus and
  releases on blur and disconnection.
- The package owns no collaboration transport.

## Searching

`applySearch(query)` returns `1` when `label` contains the
[`SearchQuery`](../search.md#searchquery), otherwise `0`. Every field is
[`Searchable`](../search.md#searchable).
