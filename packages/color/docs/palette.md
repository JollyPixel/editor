# Palettes

Use these APIs to assign repeatable colors to string keys or numeric indexes.

## `defaultPaletteColors()`

```ts
function defaultPaletteColors(): string[]
```

Returns a copy of the built-in eight-color palette.

## `hashKey()`

```ts
function hashKey(key: string): number
```

Returns the non-negative integer hash used by `colorFromKey`.

## `colorFromKey()`

```ts
function colorFromKey(
  key: string,
  colors?: readonly string[]
): string
```

Hashes `key` and selects an entry from `colors`, using the built-in palette when
`colors` is omitted. Custom palettes cannot be empty.

```ts
import { colorFromKey } from "@jolly-pixel/color";

colorFromKey("peer-42");
// An entry from the built-in palette

colorFromKey("peer-42", ["#111", "#222"]);
// An entry from the custom palette
```

The same key and palette produce the same color, so use a stable identity such
as a username or document ID when the color must survive reconnection.

## `goldenAngleColor()`

```ts
interface GoldenAngleOptions {
  saturation?: number;
  lightness?: number;
}

function goldenAngleColor(
  index: number,
  options?: GoldenAngleOptions
): string
```

Returns a hex color derived from `index`, with adjacent indexes separated by
137.5 degrees of hue. Use it for an indexed sequence that is not limited to a
fixed palette.

```ts
import { goldenAngleColor } from "@jolly-pixel/color";

goldenAngleColor(0);  // "#ea7b7b"
goldenAngleColor(1);  // "#7bea9c"
goldenAngleColor(2, { saturation: 0.5, lightness: 0.4 });
```

`saturation` defaults to `0.72` and `lightness` defaults to `0.7`. Both options
are clamped to the range from 0 to 1.

## `ColorPalette`

```ts
interface ColorPaletteOptions {
  colors?: string[];
}

class ColorPalette {
  constructor(options?: ColorPaletteOptions);

  readonly colors: readonly string[];

  next(): string;
  forKey(key: string): string;
  reset(): void;
}
```

Creates a cycling palette and freezes a copy of `colors`. With no options, it
uses the built-in palette. Custom palettes cannot be empty.

```ts
import { ColorPalette } from "@jolly-pixel/color";

const palette = new ColorPalette({
  colors: ["#111111", "#222222"]
});

palette.next();          // "#111111"
palette.next();          // "#222222"
palette.next();          // "#111111"
palette.forKey("peer");  // Stable for this key and palette
palette.reset();         // The next call returns "#111111"
```

`forKey()` does not move the `next()` cursor.

## Three.js

Palette functions return CSS color strings that can be passed to
`THREE.Color`:

```ts
new THREE.Color(colorFromKey(object.id));
```
