# `jolly-search`

`jolly-search` is a one-line search box: a magnifier, a text input and a clear
button once it holds text. A [searchable pane](../containers/pane.md#searching-content)
renders one in its header.

```html
<jolly-search placeholder="Search assets"></jolly-search>
<jolly-search compact></jolly-search>
```

It is not a field: no label column, revert button or lock. It owns its
`value`, since a query never reaches the document or other peers.

## Properties

```ts
interface Search {
  value: string; // set from outside: replaces the text, emits nothing
  placeholder: string; // default "Search"
  label: string; // default "Search", accessible name and trigger tooltip
  compact: boolean; // only a magnifier button until opened
  expanded: boolean; // compact only: the box is shown
  disabled: boolean;
}
```

A compact search collapses again when the input loses focus while empty, or
on Escape in an empty box.

## Events

```ts
interface SearchEvents {
  "jolly-input": { value: string; }; // every keystroke, filter on it
  "jolly-change": { value: string; }; // Enter, clear button, Escape
}
```

```ts
const search = document.querySelector("jolly-search");
onFieldChange<string>(search, (query) => {
  list.filter = query;
}, "jolly-input");
```

## Methods

### `open(): Promise<void>`

Expands a compact search, focuses the input and selects its text.

### `clear(): void`

Empties `value` and emits both events with `""`. Does nothing when already
empty.

## Keyboard

- Escape empties a box with text.
- In an empty compact box, Escape collapses it and focuses the magnifier.
- Escape stops there, so an enclosing dialog stays open.

## Styling

- The box fills the host. A collapsed compact search is as wide as its button.
- Parts: `box`, `trigger`.
- `--jolly-search-bg`, `--jolly-search-bg-hover`, `--jolly-search-bg-focus`:
  box fills, default the control fills.
- `--jolly-search-trigger-bg-hover`: hovered magnifier and clear buttons.
- `--jolly-search-trigger-width`, `--jolly-search-trigger-height` (default
  `16px`), `--jolly-search-trigger-icon-size` (default `12px`),
  `--jolly-search-trigger-bg` (default none) and
  `--jolly-search-trigger-opacity` (default `0.75`): the collapsed magnifier.
- A search in a [folder header](../containers/folder.md#header-actions) is
  sized and filled like the folder's `jolly-button` actions.
