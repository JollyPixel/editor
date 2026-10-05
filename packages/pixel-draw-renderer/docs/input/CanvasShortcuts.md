# CanvasShortcuts

Keyboard-driven intents of a `PixelArtCanvas`, exposed as `canvas.shortcuts`. The canvas does not listen to the keyboard: the host picks the keys for each intent and decides when the canvas owns the keyboard. Each call acts on the current [mode](../PixelArtCanvas.md#mode).

```ts
keyboard.bind("Mod+z", () => canvas.shortcuts.undo());
keyboard.bind("Delete", () => canvas.shortcuts.delete());
keyboard.bind("Mod+a", () => canvas.shortcuts.selectAll());

keyboard.on("down", (event) => {
  if (event.code === "Space") {
    canvas.shortcuts.panHeld = true;
  }
});
keyboard.on("up", (event) => {
  if (event.code === "Space") {
    canvas.shortcuts.panHeld = false;
  }
});
```

## Types

```ts
interface CanvasShortcuts {
  panHeld: boolean;
  lineHeld: boolean;
  selectAll(): boolean;
  copy(): boolean;
  paste(): boolean;
  delete(): boolean;
  undo(): boolean;
  redo(): boolean;
  rotate(direction: RotationDirection): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
}
```

## Held modifiers

### `panHeld`

```ts
get panHeld(): boolean
set panHeld(value: boolean)
```

While `true`, a left-drag pans the view in every mode and the cursor shows a grab hand. Bind it to a held key, usually `Space`.

### `lineHeld`

```ts
get lineHeld(): boolean
set lineHeld(value: boolean)
```

While `true` in `"paint"` or `"erase"` mode, the next click draws a straight line from the last clicked pixel position to the clicked endpoint. Paint and erase share this saved position. Each later click saves a new endpoint and chains another segment. Before any click, the first available cursor position while held becomes the starting position.

Setting it during a stroke of either button commits the stroke and draws a line from the mouse-down position in the stroke's color on release. Moving or releasing the mouse does not change the saved position. Setting it back to `false` cancels the preview and keeps the saved position for the next line. Mode changes and window blur also keep it. Picking, panning, selection, UV interaction, and clicks outside the texture do not change it. Replacing or resizing the texture clears it.

In `"uv"` mode it resizes a net face together with its aligned row or column, as [`UVTool`](../tools/UVTool.md#resizable) describes. Bind it to a held key, usually `Shift`.

Both setters ignore a value equal to the current one, so auto-repeated keydowns are harmless. A window blur sets both back to `false`, so a key released outside the page does not stay held.

## Intents

Each method returns `true` when it handled the intent. The host should then prevent the browser default of the key; on `false`, it should let the key pass on to the page or to the next binding.

| Method | Effect | Returns `false` when |
|---|---|---|
| `selectAll()` | In `"select"` mode, selects the entire current texture, including transparent pixels and 1×1 textures. | Another mode is active, or a selection is being created, moved or resized. |
| `copy()` | Copies the selection to the clipboard. | There is no selection. |
| `paste()` | Pastes the clipboard as a floating selection. | Never. |
| `delete()` | In `"select"` mode, runs [`tools.select.delete()`](../tools/SelectTool.md). In `"uv"` mode, removes the selected UV region. | The mode has nothing to delete. |
| `undo()` | Same as `canvas.undo()`. | History is off or empty. |
| `redo()` | Same as `canvas.redo()`. | History is off or there is nothing to redo. |
| `rotate(direction)` | Turns the selection 90 degrees in `"select"` mode, or the selected UV region or slot in `"uv"` mode. `direction` is `"cw"` or `"ccw"`. | The mode has nothing to rotate. |
| `flipHorizontal()` | Mirrors the selection left to right in `"select"` mode. | There is no selection. |
| `flipVertical()` | Mirrors the selection top to bottom in `"select"` mode. | There is no selection. |

`copy()` and `paste()` start the clipboard work and return before it ends. Read the outcome from [`onClipboardResult`](../PixelArtCanvasOptions.md#onclipboardresult), or await `canvas.copySelection()` and `canvas.pasteClipboard()` instead.
