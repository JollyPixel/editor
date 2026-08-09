# BrushTool

Controls color picking for the brush. `PixelArtCanvas` exposes it as `canvas.tools.brush`; picked colors are stored in `canvas.brush.primary`.

```ts
canvas.mode = "paint";
canvas.tools.brush.pickArmed = true;
```

In paint mode, `Ctrl`+right-click also picks a color without starting a secondary-color stroke.

## Types

```ts
interface BrushTool {
  pickArmed: boolean;
  pick(x: number, y: number): RGBA | null;
}
```

## Properties

### `pickArmed`

```ts
get pickArmed(): boolean
set pickArmed(value: boolean)
```

When `true`, the next left-click inside the texture in paint mode picks a color instead of painting. A successful pick disarms it. Leaving paint mode also disarms it.

## Methods

### `pick(x, y)`

```ts
pick(x: number, y: number): RGBA | null
```

Samples a pixel at texture coordinates and assigns its color and opacity to `canvas.brush.primary`. It can be called in any mode. An out-of-bounds coordinate returns `null` without changing the brush or `pickArmed`.

## Events

### `"colorpicked"`

Every successful pick dispatches a bubbling, composed `CustomEvent` from `canvas.canvas()` with this detail:

```ts
interface ColorPickedDetail {
  hex: string;
  opacity: number;
}
```

```ts
canvas.canvas().addEventListener("colorpicked", (event) => {
  const { hex, opacity } = (
    event as CustomEvent<ColorPickedDetail>
  ).detail;
});
```
