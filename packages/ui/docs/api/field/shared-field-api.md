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
  editors: readonly PresencePeer[]; // property only, peers editing this field
  path: string | null; // lock identity, null opts out
  readonly lockedBy: PresencePeer | null; // derived from editors
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

- `--jolly-field-inset-start` sets the space before the label, default
  `--jolly-space-1`. It also indents description and error lines.
- `--jolly-field-inset-end` sets the space after the value, default `0px`, so
  a filled control ends flush with its container and the folder header edge.
  An unlabeled field uses it on both sides. Raise it only when a row ends in
  text.
- `jolly-property-row` and a `jolly-separator` caption follow the same insets,
  so they stay aligned with the labels.
- Set the start inset to `0px` inside a padded container, such as a dialog
  body.

## Collaboration

```ts
field.editors = [
  { clientId: "ada", displayName: "Ada", color: "#e07a5f" }
];
field.lockedBy; // Ada: the field is locked
```

- `editors` lists the peers editing the field, as
  [`PresencePeer`](../peer/presence.md#properties).
- `lockedBy` is the first of them, or `null` when the list holds the local
  peer (`self: true`): local focus beats a remote claim.
- A locked field is read-only and stays focusable. The row shows the holder's
  colour as a left bar and tint, and "Held by" on hover. The layout does not
  change.
- While the field is not locked, the other peers show as chips at the end of
  the label cell.
- `path` is the identity the field claims while focused, agreed between
  clients. Under a pane with a [`FieldLockSource`](../peer/field-locks.md),
  `editors` is written for the field: it claims on focus and releases on blur
  and disconnection.
- The package owns no collaboration transport.

## Searching

`applySearch(query)` returns `1` when `label` contains the
[`SearchQuery`](../search.md#searchquery), otherwise `0`. Every field is
[`Searchable`](../search.md#searchable).
