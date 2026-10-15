# Button and separator facades

## `addButton(options?): FacadeButton`

Creates a `jolly-button`.

```ts
interface ButtonOptions {
  title?: string; // the button text
}

pane.addButton({ title: "Reset" }).on("click", (event: MouseEvent) => {
  state.value = defaults.value;
  pane.refresh();
});
```

`on("click", handler)` adds a click listener and returns the builder.

## `addSeparator(): FacadeSeparator`

Creates a `jolly-separator`. It has no value and no events.
