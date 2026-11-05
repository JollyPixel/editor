# Palettes

Use these APIs to assign repeatable colors to string keys or numeric indexes,
and to sort, read and write palettes.

## `ColorSequence`

```ts
interface GoldenAngleOptions {
  saturation?: number; // default 0.72
  lightness?: number; // default 0.7
}

class ColorSequence {
  static readonly default: ColorSequence;
  static from(colors: readonly string[]): ColorSequence;
  static goldenAngle(options?: GoldenAngleOptions): ColorSequence;

  constructor(colorAt: (index: number) => string);

  at(index: number): string;
  pick(key: string): string;
}
```

An endless sequence of hex colors. `at` reads it by index, `pick` hashes a key
with `hashKey` and reads that index.

- `default` cycles through a built-in eight-color palette.
- `from` cycles through a copy of `colors`, in both directions. Throws a
  `RangeError` when `colors` is empty.
- `goldenAngle` turns the hue 137.5 degrees per index, so neighbours stay far
  apart and the sequence never repeats.

```ts
import { ColorSequence } from "@jolly-pixel/color";

ColorSequence.default.pick("peer-42");  // stable for this key
ColorSequence.goldenAngle().at(0);       // "#ea7b7b"
ColorSequence.goldenAngle().at(1);       // "#7bea9c"
ColorSequence.from(["#111", "#222"]).at(2);  // "#111"
```

Use a stable identity such as a peer or document ID when the color must
survive reconnection.

## `hashKey()`

```ts
function hashKey(key: string): number
```

Returns the non-negative integer hash behind `pick`. Use it to spread other
choices, such as default avatars, over the same keys.

## Three.js

Sequences return CSS color strings that can be passed to `THREE.Color`:

```ts
new THREE.Color(ColorSequence.default.pick(object.id));
```

## `sortColors()`

```ts
type ColorSortKey = "hue" | "chroma" | "lightness" | "alpha";

function sortColors<TColor extends RGBA>(
  colors: readonly TColor[],
  key: ColorSortKey
): TColor[]
```

Returns a sorted copy of the same color objects, ascending, using OKLCH
channels. The sort is stable, so ties keep their order.

- `"hue"` puts grays (chroma under 0.02) first by lightness, then the other
  colors by hue, then by lightness.

## `PaletteFile`

```ts
class PaletteFile {
  readonly colors: readonly RGBA8[];
  readonly name: string | null;

  constructor(colors: readonly RGBA8[], name?: string | null);
}
```

A named list of byte colors. The constructor copies `colors`. It throws a
`RangeError` when the list is empty and a `TypeError` when a channel is not
an integer byte.

## `PaletteFormat`

```ts
type PaletteExtension = "gpl" | "hex";

class PaletteFormat {
  static readonly gpl: PaletteFormat;
  static readonly hex: PaletteFormat;
  static fromFileName(fileName: string): PaletteFormat;

  readonly extension: PaletteExtension;

  parse(text: string): PaletteFile;
  serialize(file: PaletteFile): string;
}
```

One object per palette file format.

- `gpl` is the GIMP palette format used by GIMP, Aseprite and Lospec. A
  `Channels: RGBA` header adds an alpha column, as Aseprite writes it.
- `hex` is the Lospec format: one `rrggbb` or `rrggbbaa` color per line,
  with an optional `#`.
- `fromFileName` picks `hex` for a `.hex` name, in any case, and `gpl`
  otherwise.
- `serialize` writes the alpha column or the eight digit form only when a
  color is translucent. GPL rows are named after their hex value.

### `PaletteParseError`

```ts
class PaletteParseError extends Error {
  readonly line: number | null;
}
```

Thrown by `parse` for a missing GPL header, a broken row or an empty palette.
`line` is 1-based, or `null` when the error is not tied to a line.

```ts
import { PaletteFormat } from "@jolly-pixel/color";

const file = PaletteFormat.fromFileName("sunset.gpl").parse(text);
PaletteFormat.hex.serialize(file);
```
