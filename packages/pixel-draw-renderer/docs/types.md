# types

Shared value types used across the package's public API.

```ts
type Vec2 = {
  x: number;
  y: number;
};

type Mode = "paint" | "move" | "fill" | "select";

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}
```

`Vec2` is a texture- or canvas-space pixel coordinate, depending on context. See the individual method it's passed to. `SelectionRect` is always in texture-space pixel coordinates; it's used by `PixelBuffer.drawRegion` and by the package's internal selection tool.

`Mode` is re-exported from [`CanvasManager.md`](./CanvasManager.md) rather than from here directly (`export type { Mode }` in `CanvasManager.ts`), but originates in this module.

One more type lives in this module but isn't itself exported from the package:

```ts
type ColorInput = string | Color; // Color is colorjs.io's Color class
```

`ColorInput` is used structurally throughout the package wherever a color option is accepted: a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a colorjs.io `Color` instance. The type alias itself can't be imported by name.
