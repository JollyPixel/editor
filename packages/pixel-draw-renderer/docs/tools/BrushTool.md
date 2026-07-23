# BrushTool

Color-picking surface of the brush, reached via [`PixelArtCanvas.tools.brush`](../PixelArtCanvas.md#tools). Distinct from [`Brush`](./Brush.md); only exposes the pick-into-`brush.primary` behavior.

```ts
export interface BrushTool {
  pickArmed: boolean;
  pick(x: number, y: number): RGBA | null;
}
```

Three independent paths sample a pixel color into `brush.primary`:

| Path | Trigger | Notes |
|---|---|---|
| `pickArmed = true` | Next left-click in `"paint"` mode | Single-shot; auto-disarms. Switching mode disarms it. |
| `pick(x, y)` | Called directly, anytime | Returns `RGBA` or `null` if out-of-bounds |
| `Ctrl`+right-click | Mousedown in `"paint"` mode | Single-shot; never starts a secondary stroke |

> [!IMPORTANT]
> All paths dispatch a `"colorpicked"` CustomEvent (`detail: { hex, opacity }`, bubbling and composed) on `canvas()`. Use it to sync a UI color swatch.
