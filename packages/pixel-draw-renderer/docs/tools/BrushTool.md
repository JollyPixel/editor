# BrushTool

The public color-picking surface of the brush, reached via [`PixelArtCanvas.tools.brush`](../PixelArtCanvas.md#tools). This is distinct from [`Brush`](./Brush.md) (`PixelArtCanvas.brush`), the value object that holds the brush's colors, size, and highlight — `BrushTool` only exposes the pick-into-`brush.primary` behavior.

```ts
export interface BrushTool {
  pickArmed: boolean;
  pick(x: number, y: number): RGBA | null;
}
```

Three independent paths sample a pixel color into `brush.primary`:

| Path | Trigger | Scope |
|---|---|---|
| `pickArmed = true` | Next left-click in `"paint"` mode | Arms/disarms itself; no effect in any other mode |
| `pick(x, y)` | Called directly, any time | Programmatic entry point (e.g. a toolbar button); independent of `mode`/`pickArmed` |
| `Ctrl`+right-click | Mousedown, in `"paint"` mode | Always available; single-shot, independent of `pickArmed` |

- `pickArmed`: not a separate `Mode`, just a flag on top of `"paint"`. While armed, the next left-click samples that pixel instead of painting, applies it, and disarms itself. Switching `mode` away from `"paint"` disarms it automatically. A click outside the texture bounds is ignored (stays armed) rather than sampling transparent black.
- `pick(x, y)`: returns the sampled `RGBA`, or `null` (brush left untouched) when `(x, y)` is outside the texture.
- `Ctrl`+right-click: a single-shot sample-and-apply at mousedown, not tracked as a drag, and does not start a `brush.secondary` stroke. Plain right-click (no `Ctrl`) is not a picker; see [`mode`](../PixelArtCanvas.md#mode) for what it does instead.

> [!IMPORTANT]
> Every path dispatches a `"colorpicked"` CustomEvent (`detail: { hex, opacity }`, bubbling and composed) on the element returned by `canvas()`; use it to mirror the pick onto a UI color swatch.
