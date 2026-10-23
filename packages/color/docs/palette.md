# Palettes

Use these APIs to assign repeatable colors to string keys or numeric indexes.

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
