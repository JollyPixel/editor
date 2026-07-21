# SelectTool

The public surface of `"select"` mode, reached via [`PixelArtCanvas.tools.select`](../PixelArtCanvas.md#tools). Covers the shape sub-mode toggle, a read-only selection flag, and the programmatic transforms. The rectangle-drag / move / copy / paste / delete gestures are driven by input and keybindings (see [PixelArtCanvas.md](../PixelArtCanvas.md#mode) and [input/Keybindings.md](../input/Keybindings.md)).

```ts
export interface SelectTool {
  shape: boolean;
  readonly hasSelection: boolean;
  rotate(): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
}
```

## `shape`

Reads or sets whether `"select"` mode's click-to-start (on empty space, not on top of an existing selection) computes a magic-wand shape selection around the clicked pixel's connected region (`true`), instead of starting a rectangle drag (`false`, the default).

Runtime-only: there is no constructor option. Toggling this value clears any active selection.

> [!IMPORTANT]
> A connected region smaller than 2 pixels does not produce a selection; the click is a no-op.

## `hasSelection`

Read-only. `true` when a committed selection exists to transform — idle or actively being dragged — and `false` while a rectangle is still being drawn or when nothing is selected. Use it to enable/disable transform controls without side effects.

## `rotate` / `flipHorizontal` / `flipVertical`

Programmatic equivalents of the `R`/`H`/`V` select-mode keybindings (e.g. for a toolbar button): same underlying commit path, so keyboard and button can't drift apart. `rotate()` turns the selection 90° clockwise around its center; the flips mirror its content in place. Each returns `false` and does nothing without an active `"select"`-mode selection (i.e. `hasSelection === false`).
