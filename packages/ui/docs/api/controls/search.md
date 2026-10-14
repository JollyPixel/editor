# `jolly-search`

`jolly-search` is a one-line search box: a magnifier glyph, a text input, and
a clear button that shows once the box holds text. It works on its own, and
[`jolly-pane`](../containers/pane.md#searching-content) renders one in its
header when the pane is `searchable`.

```html
<jolly-search placeholder="Search assets"></jolly-search>
<jolly-search compact></jolly-search>
```

It is not a field: it has no label column, revert button or lock. It owns its
`value`, unlike the field elements, which wait for the owner to write a value
back. A query is view state that never reaches the document or other peers,
so there is nothing for an owner to arbitrate.

## Properties

### `value`

`string`. Defaults to `""`. Typing replaces it. Setting it from outside
replaces the text in the box and emits nothing.

### `placeholder`

`string`. Defaults to `"Search"`.

### `label`

`string`. Defaults to `"Search"`. The accessible name of the input and of the
compact trigger, which also shows it as a tooltip.

### `compact`

`boolean`, reflected. Defaults to `false`. A compact search renders only a
magnifier button until it is opened.

### `expanded`

`boolean`, reflected. Defaults to `false`. Only a compact search reads it:
`true` swaps the button for the box. Clicking the button and `open()` set it.
It goes back to `false` when the input loses focus while empty, or on Escape
in an empty box.

### `disabled`

`boolean`, reflected. Defaults to `false`.

## Methods

### `open()`

Expands a compact search, then focuses the input and selects its text.
Returns a promise that settles once the input has focus.

### `clear()`

Empties `value` and emits `jolly-input` and `jolly-change` with `""`. Does
nothing when `value` is already empty.

## Events

`jolly-input` fires on every keystroke with `{ value }`; filter on it.
`jolly-change` fires with `{ value }` on Enter and when the clear button or
Escape empties the box. Both bubble and cross shadow roots, and
[`onFieldChange`](../dom.md) subscribes to either.

```ts
const search = document.querySelector("jolly-search");
onFieldChange<string>(search, (query) => {
  list.filter = query;
}, "jolly-input");
```

## Keyboard

Escape empties a box that holds text. In an empty compact box it collapses
the search and moves focus back to the magnifier button. Either way the
Escape stops there, so an enclosing dialog stays open.

## Styling

The box fills the width of the host, and a collapsed compact search is only
as wide as its button. The component exposes `box` and `trigger` CSS parts.

`--jolly-search-bg`, `--jolly-search-bg-hover` and `--jolly-search-bg-focus`
fill the box and default to the control fills. `--jolly-search-trigger-bg-hover`
fills the hovered magnifier and clear buttons.
