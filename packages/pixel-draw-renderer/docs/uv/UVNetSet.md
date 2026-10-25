# UVNetSet

The [saved UV nets](./SavedUVNet.md) of one texture, and the id of the net its regions unfold with by default. A [`PixelDocument`](../PixelDocument.md#uv-nets) holds one; it is saved in the [`.pixelart` file](../serialization/index.md) and changed through [commands](../PixelCommand.md), so peers see the same nets.

```ts
import {
  SavedUVNet,
  UVNetSet
} from "@jolly-pixel/pixel-draw.renderer";

const nets = UVNetSet.empty
  .with(new SavedUVNet({
    id: "caps",
    name: "Caps and sides",
    rows: [[["top", "bottom"], ["front", "back", "left", "right"]]]
  }))
  .withDefault("caps");

canvas.uv.net = nets.get("caps")!.net;
```

The set is immutable: every change returns a new set, or the same set when nothing changed.

## Types

```ts
interface UVNetSetData {
  defaultId?: string;
  nets: SavedUVNetData[];
}
```

`SavedUVNetData` is described with [`SavedUVNet`](./SavedUVNet.md#types).

## Creating

```ts
static readonly empty: UVNetSet
static from(data: UVNetSetData): UVNetSet
static parse(value: unknown): UVNetSet | null
```

`parse` returns `null` when `defaultId` is empty, two nets share an id, or [`SavedUVNet.parse`](./SavedUVNet.md#creating) rejects a net. `from` throws a `TypeError` in the same cases.

## Members

```ts
readonly defaultId: string | null;
get isEmpty(): boolean;
get(id: string): SavedUVNet | undefined;
[Symbol.iterator](): IterableIterator<SavedUVNet>;

with(net: SavedUVNet): UVNetSet;
without(id: string): UVNetSet;
withDefault(id: string | null): UVNetSet;
toJSON(): UVNetSetData;
```

`defaultId` may name a net that is not in the set, such as a net the host provides or one that was deleted; the host decides what an unknown id falls back to. `isEmpty` is true when the set has no net and no default. `with` adds a net or replaces the one with the same id, and returns the same set when the saved net [`equals`](./SavedUVNet.md#members) the new one. Nets keep the order they were first added in.
