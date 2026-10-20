# Overflow titles

A label cut off with an ellipsis shows its full text as a native tooltip on
hover. Tree rows, field and `jolly-property-row` labels, folder headers,
context menu items and pane group tabs do this.

- `overflow-title="off"` turns it off for an element and its descendants,
  across shadow boundaries. Any other value turns it back on below an `"off"`.

```html
<jolly-scope overflow-title="off">
  <jolly-tree overflow-title="on"></jolly-tree>
  <jolly-text label="Name"></jolly-text>
</jolly-scope>
```

## `revealOverflowTitle(event: Event): void`

The `pointerenter` handler, for truncating labels a consumer renders itself.

```ts
html`<span class="label" @pointerenter=${revealOverflowTitle}>${name}</span>`;
```

## `syncOverflowTitle(element: HTMLElement): void`

Sets `title` to the element's text while `scrollWidth` exceeds `clientWidth`
and the attribute allows it, and removes it otherwise.
