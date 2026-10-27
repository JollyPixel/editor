# `jolly-show-more`

`jolly-show-more` shows its first rows and hides the rest behind a centered
"Show N more" button.

```html
<jolly-folder label="Mesh renderer">
  <jolly-show-more limit="5" storage-key="inspector:more:mesh">
    <jolly-select label="Geometry"></jolly-select>
    <jolly-number label="Width"></jolly-number>
    <!-- more rows -->
  </jolly-show-more>
</jolly-folder>
```

## Properties

```ts
interface ShowMore {
  limit: number; // default 5, rows shown while collapsed
  expanded: boolean; // default false
  storageKey: string; // attribute storage-key
  storage: StorageAdapter; // property only, default LocalStorageAdapter
}
```

## Rows

- Every element child of the default slot is a row, including `hidden` ones.
- The button appears only when two or more rows would be hidden. Seven rows
  with `limit` 5 hide two; six rows hide none.
- Rows are counted again when children are added or removed.
- "Show less" collapses back to `limit`. Collapsing while focus is inside a
  row that hides moves focus to the button.

## Slots and parts

- Slots: default (rows).
- Parts: `toggle`.

## Storing the state

- Without `storage-key`, `expanded` resets with the element.
- With `storage-key`, the button stores `expanded` and the element restores it
  when the key or `storage` changes. A stored value wins over the `expanded`
  attribute.
- One key can be shared, so every inspector of one component kind expands
  together.

## Searching

In a [searchable pane](./pane.md#searching-content) or a
[folder](./folder.md#searching), rows are filtered like the folder's own
content. While a search is active, every match shows whatever the limit, and
the button is removed. Clearing the search restores the limit and the stored
state.
