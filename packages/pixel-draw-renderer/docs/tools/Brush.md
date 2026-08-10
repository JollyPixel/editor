# Brush

Stores the colors, size and highlight colors used by the drawing tools. `PixelArtCanvas` exposes it as `canvas.brush`.

```ts
canvas.brush.primary.set("#ff6600", 0.8);
canvas.brush.secondary.set("#3366ff");
canvas.brush.size = 3;
```

Paint mode uses `primary` for left-click strokes and `secondary` for right-click strokes. See [`BrushTool`](./BrushTool.md) for color picking.

## Types

```ts
new Brush(options?: BrushOptions)

type ColorInput = string | Color;

interface BrushOptions {
  color?: ColorInput;
  secondaryColor?: ColorInput;
  size?: number;
  maxSize?: number;
  highlight?: {
    colorInline?: ColorInput;
    colorOutline?: ColorInput;
  };
}

interface BrushColor {
  set(color: ColorInput, opacity?: number): void;
  asRGBA(): RGBA;
  asString(format?: "rgba" | "hex"): string;
  get opacity(): number;
  set opacity(value: number);
}
```

`ColorInput` accepts a CSS color string or a [colorjs.io](https://colorjs.io) `Color` instance.

The primary color defaults to `"#000000"` and the secondary color to `"#FFFFFF"`. Both `size` and `maxSize` default to `32`. Highlight colors default to a white inner stroke and black outer stroke.

## Properties

### `primary` / `secondary`

```ts
readonly primary: BrushColor
readonly secondary: BrushColor
```

Each slot stores a color and opacity. `set()` preserves the current opacity when its second argument is omitted. Opacity is clamped to `[0, 1]`.

`asRGBA()` returns a mutable snapshot with byte-valued RGBA components. `asString()` returns `rgba(r, g, b, a)` by default. Pass `"hex"` for a six-digit hex color without opacity.

### `size`

```ts
get size(): number
set size(value: number)
```

Brush size in pixels, clamped to `[1, maxSize]`. Values are not rounded, so use whole numbers for pixel-aligned brushes.

### `colorInline` / `colorOutline`

```ts
get colorInline(): string
set colorInline(value: ColorInput)

get colorOutline(): string
set colorOutline(value: ColorInput)
```

Colors for the inner and outer strokes of the brush cursor.

## Methods

### `swapColors()`

```ts
swapColors(): void
```

Exchanges the primary and secondary colors, including their opacity.

### `affectedPixels(x, y)`

```ts
affectedPixels(x: number, y: number): IterableIterator<Vec2>
```

Yields the coordinates covered by the brush square. Odd sizes are centered on `(x, y)`; even sizes place the extra half to the left and above. Coordinates are not clipped to the texture bounds.

The returned iterator is single-use. Spread it into an array when the coordinates need to be reused.
