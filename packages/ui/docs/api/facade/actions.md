# Button and separator facades

## Buttons

`addButton(options?)` creates `jolly-button`.

```ts
interface ButtonOptions {
  title?: string;
}

const reset = pane.addButton({ title: "Reset" });
reset.on("click", (event: MouseEvent) => {
  state.value = defaults.value;
  pane.refresh();
});
```

`title` defaults to `""` and becomes the button text. `on("click", handler)`
registers a DOM click listener and returns the same builder for chaining.

The button builder exposes `element`, `hidden`, `disabled`, and `dispose()`.

## Separators

```ts
const separator = pane.addSeparator();
```

`addSeparator()` creates `jolly-separator`. Its builder exposes `element`,
`hidden`, `disabled`, and `dispose()`. It has no events or bound value.

