# SavedUVNet

A named grid [UV net](./UVNet.md) saved with one texture. A [`UVNetSet`](./UVNetSet.md) holds the saved nets of a pixel document.

```ts
import { SavedUVNet } from "@jolly-pixel/pixel-draw.renderer";

const caps = new SavedUVNet({
  id: "caps",
  name: "Caps and sides",
  rows: [[["top", "bottom"], ["front", "back", "left", "right"]]]
});

document.saveUvNet(caps.with({ name: "Top and sides" }).toJSON());
```

A saved net is immutable and always a grid; packing needs no saved net.

## Types

```ts
interface SavedUVNetData {
  id: string;
  name: string;
  rows: UVNetRow[];
}

interface SavedUVNetInit {
  id: string;
  name: string;
  rows: Iterable<Iterable<UVNetCellInput>>;
}
```

`SavedUVNetData` is the saved form, used by commands and the `.pixelart` file: `rows` lists every cell as an array of slots, or `null` for an empty cell. `SavedUVNetInit` takes rows in any form the [`UVNet` constructor](./UVNet.md#constructor) accepts, such as a single slot for a cell.

## Creating

```ts
new SavedUVNet(init: SavedUVNetInit)
static parse(value: unknown): SavedUVNet | null
```

The constructor throws a `TypeError` for an empty id, and the `UVNet` constructor's `RangeError` for rows without slots or with a slot listed twice. `parse` returns `null` in those cases, and when a field has the wrong type or a cell is not an array of slot names.

## Members

```ts
readonly id: string;
readonly name: string;
readonly rows: readonly UVNetRow[];
readonly net: UVNet;

with(changes: { name?: string; rows?: Iterable<Iterable<UVNetCellInput>>; }): SavedUVNet;
equals(other: SavedUVNet): boolean;
toJSON(): SavedUVNetData;
```

`rows` are normalized as `UVNet` stores them: a single slot becomes an array of one slot, and an empty cell array becomes `null`. `with` keeps the id and throws like the constructor. `equals` compares the id, name and rows.
