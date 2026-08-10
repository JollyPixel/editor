# BrushTool

Controls color picking for the brush. `PixelArtCanvas` exposes it as `canvas.tools.brush`.

```ts
canvas.mode = "paint";
canvas.tools.brush.pickArmed = true;
```

When armed in paint mode, left-click picks into the primary color and right-click picks into the secondary color. `Ctrl`+right-click remains a one-shot pick into the primary color when the picker is not armed.

## Types

```ts
interface BrushTool {
  pickArmed: boolean;
  pick(
    x: number,
    y: number,
    slot?: "primary" | "secondary"
  ): RGBA | null;
}
```

## Properties

### `pickArmed`

```ts
get pickArmed(): boolean
set pickArmed(value: boolean)
```

When `true`, the next left-click or right-click inside the texture in paint mode picks a color instead of painting. Left-click assigns the sampled color to `canvas.brush.primary`; right-click assigns it to `canvas.brush.secondary`. A successful pick disarms it. Leaving paint mode also disarms it.

## Methods

### `pick(x, y, slot?)`

```ts
pick(
  x: number,
  y: number,
  slot?: "primary" | "secondary"
): RGBA | null
```

Samples a pixel at texture coordinates and assigns its color and opacity to the requested brush slot. The slot defaults to `"primary"`. It can be called in any mode. An out-of-bounds coordinate returns `null` without changing the brush or `pickArmed`.

## Events

### `"colorpicked"`

Every successful pick dispatches a bubbling, composed `CustomEvent` from `canvas.canvas()` with this detail:

```ts
interface ColorPickedDetail {
  hex: string;
  opacity: number;
  slot: "primary" | "secondary";
}
```

```ts
canvas.canvas().addEventListener("colorpicked", (event) => {
  const { hex, opacity, slot } = (
    event as CustomEvent<ColorPickedDetail>
  ).detail;
});
```
