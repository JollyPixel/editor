# NormalMap

The normal map of one texture, generated from its pixels, its [islands](./IslandMap.md) and its [`NormalMapConfig`](./NormalMapConfig.md). It owns an RGBA8 output buffer and keeps it up to date while retained.

```ts
const normals = doc.normals;
const release = normals.retain();

normals.on("changed", ({ bounds }) => {
  texture.needsUpdate = true;
});

release();
```

`PixelDocument.normals` creates the document's instance on first access and returns the same one afterwards. Islands come from [`PixelDocument.islands`](../PixelDocument.md#normal-map), so a host that supplies its own faces with `useIslandFaces` shares one map with every view of the document.

## Retaining

```ts
retain(): () => void;
readonly retained: boolean;
```

A `NormalMap` does nothing until retained. The first `retain()` subscribes to its source and schedules a full generation. When the last returned function is called, it unsubscribes and drops its output. Calling a release function twice has no effect.

## Output

```ts
readonly pixels: Uint8ClampedArray;
readonly size: Vec2;
readonly islands: IslandMap;
flush(): void;
```

`pixels` is the live output, RGBA8, row-major, empty while not retained. Do not write to it. A resize allocates a new array. `islands` is cached while retained; otherwise each read asks the source.

Normals use the OpenGL convention: red points right and green points up in the image. Each pixel stores `round((n * 0.5 + 0.5) * 255)` with alpha `255`. Transparent pixels and pixels of an `"off"` island are flat, `(128, 128, 255, 255)`. With the feature off, the whole map is flat.

Work is coalesced into one pass per animation frame. `flush()` runs the pending pass now, for example before an export.

## Preview

```ts
readonly config: NormalMapConfig | null;
preview(config: NormalMapConfig | null): void;
```

`preview` regenerates from `config` instead of the source's settings, with no history and no command. Use it while a slider is dragged, then commit the value through the document. `config` returns the settings the output is generated from.

A preview lasts until `preview(null)` or until the source's settings change, by a local edit, a remote command, undo or a snapshot. It is ignored while the feature is off.

## Events

| Event | Payload | When |
|---|---|---|
| `changed` | `{ bounds: SelectionRect }` | a pass rewrote `bounds` |
| `resized` | `{ size: Vec2 }` | the output was reallocated, before the `changed` of the same pass |

## Regeneration

| Change | Regenerated |
|---|---|
| pixels written in `bounds` | the islands touching `bounds` grown by 1 px; `"regions"` and `"bevel"` islands whole, others only around `bounds` |
| defaults patched, feature toggled, snapshot | every island |
| zone set or deleted | the islands of that region |
| UV region created, deleted, moved, rotated or changed state; resize; texture replaced | the island map, then every island |

## Generation

For each island, with the resolved settings:

1. Height in `[0, 1]` per pixel, from `height`, `invert` and alpha.
2. `border: "bevel"` multiplies heights by the bevel profile of the distance to the island edge.
3. Gradient by central difference, `dx = (h(x+1) - h(x-1)) * strength`, `dy = (h(x, y+1) - h(x, y-1)) * strength`, normal `normalize(-dx, dy, 1)`. A difference toward a transparent neighbour is multiplied by `edgeIntensity`.
4. With `levels >= 3`, `n.x` and `n.y` snap to `levels` steps in `[-1, 1]` and the normal is renormalized.

Distances are 4-connected and start at `0` on the edge pixel. Bevel profiles use `t = min(distance, width) / width`: `"linear"` is `t`, `"round"` is `sqrt(1 - (1 - t)²)`.

### Border

| `border` | Sample outside the island |
|---|---|
| `"wrap"` | the opposite edge of the island; only on an `isRect` island, others use `"clamp"` |
| `"clamp"` | the center pixel itself |
| `"bevel"` | `0` |

## Custom sources

```ts
new NormalMap(source: NormalMapSource);

interface NormalMapSource {
  size(): Vec2;
  pixels(): Uint8Array | Uint8ClampedArray;
  islands(): IslandMap;
  config(): NormalMapConfig | null;
  connect(normalMap: NormalMap): () => void;
}

invalidate(bounds: SelectionRect): void;
invalidateRegions(regionIds: Iterable<string>): void;
invalidateIslands(): void;
invalidateAll(): void;
```

A source other than a document implements `NormalMapSource`. `pixels()` may return the live buffer: it is only read. `islands()` builds the [island map](./IslandMap.md), for example with `IslandMap.fromFaces`; it is called again after `invalidateIslands`. `connect` subscribes to the source's changes and calls the `invalidate*` methods, and returns the function that unsubscribes.

## NormalMapGenerator

```ts
static generate(input: NormalMapInput): Uint8ClampedArray;
writeIsland(
  input: NormalMapInput,
  output: Uint8ClampedArray,
  island: Island,
  area?: SelectionRect
): SelectionRect | null;

interface NormalMapInput {
  size: Vec2;
  pixels: Uint8Array | Uint8ClampedArray;
  islands: IslandMap;
  config: NormalMapConfig | null;
}
```

The pure generator behind `NormalMap`, with no DOM. `generate` returns a full map. `writeIsland` rewrites one island, or only `area` of it when its settings allow, and returns the rect it wrote. An instance reuses its scratch buffers between calls. `output` must be 4-byte aligned, which every typed array allocated on its own is.
