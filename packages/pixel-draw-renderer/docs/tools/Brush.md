# Brush

Stores the colors, ink, size and highlight colors used by the drawing tools. `PixelArtCanvas` exposes it as `canvas.brush`.

```ts
canvas.brush.primary.set("#ff6600", 0.8);
canvas.brush.secondary.set("#3366ff");
canvas.brush.size = 3;
```

Paint mode uses `primary` for left-click strokes and `secondary` for right-click strokes; erase mode uses `erase` for both. See [`BrushTool`](./BrushTool.md) for color picking.

## Types

```ts
new Brush(options?: BrushOptions)

type ColorInput = string | Color;

interface BrushOptions {
  color?: ColorInput;
  secondaryColor?: ColorInput;
  eraseColor?: ColorInput;
  ink?: BrushInkName; // default "blend"
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

The primary color defaults to `"#000000"`, the secondary color to `"#FFFFFF"`, and `eraseColor` to transparency. An explicit `eraseColor` is opaque, so erase mode then repaints instead of clearing. Both `size` and `maxSize` default to `32`. Highlight colors default to a white inner stroke and black outer stroke.

## Properties

### `primary` / `secondary` / `erase`

```ts
readonly primary: BrushColor
readonly secondary: BrushColor
readonly erase: BrushColor
```

Each slot stores a color and opacity. `erase` is what erase mode writes; assigning it a color and opacity changes what erasing leaves behind. `set()` preserves the current opacity when its second argument is omitted. Opacity is clamped to `[0, 1]`.

`asRGBA()` returns a mutable snapshot with byte-valued RGBA components. `asString()` returns `rgba(r, g, b, a)` by default. Pass `"hex"` for a six-digit hex color without opacity.

### `ink`

```ts
type BrushInkName = "blend" | "replace" | "lock-alpha";

get ink(): BrushInkName
set ink(value: BrushInkName)
```

How strokes, lines and fills combine the brush color with the pixels under it. Erasing always replaces. Setting an unknown name throws a `RangeError`.

- `"blend"` composites the color over the pixel with straight alpha in sRGB. Opaque colors and fully transparent ones are written as they are, so a transparent brush still clears.
- `"replace"` writes the color, alpha included.
- `"lock-alpha"` mixes the color into the pixel by the brush opacity and keeps the pixel's alpha. Transparent pixels stay untouched.

A stroke inks each pixel once, against the color it had before the stroke, so going over a pixel twice in one drag does not darken it.

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

### `paintColor(source)`

```ts
paintColor(source: BrushPaintSource): RGBA
```

Returns the raw color of the given source, where `BrushPaintSource` is `"primary" | "secondary" | "erase"`, before any ink.

### `painter(source)`

```ts
type BrushPainter = (under: RGBA8) => RGBA8;

painter(source: BrushPaintSource): BrushPainter
```

Returns the function that inks the current color of `source` over a pixel. It keeps that color and ink, so later brush changes do not affect it. Every drawing tool paints through it.

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
