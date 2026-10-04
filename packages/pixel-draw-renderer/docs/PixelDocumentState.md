# PixelDocumentState

The pixels, UV map and normal map settings of a pixel document, without history, events or DOM. It is the one place [commands](./PixelCommand.md) are applied: a [`PixelDocument`](./PixelDocument.md) applies remote commands, undo and redo through its own state, and a server folds a room's commands into a headless one.

```ts
const state = new PixelDocumentState({
  buffer: new PixelBuffer({ size: { x: 32, y: 32 } })
});

state.apply(toDocumentCommand(command));
```

## Constructor

```ts
interface PixelDocumentStateOptions<TBuffer extends DefaultPixelBuffer> {
  buffer: TBuffer;
  onNormalMapChanged?: (regionIds: string[] | null) => void;
}
```

`TBuffer` defaults to [`PixelBuffer`](./buffer/PixelBuffer.md). `onNormalMapChanged` receives the regions whose zone changed, or `null` when the whole configuration changed.

## Properties

```ts
readonly buffer: TBuffer;
readonly uv: UVMap;
readonly normalMap: NormalMapConfig | null;
```

`uv` is a [`UVMap`](./uv/UVMap.md) sized by `buffer`.

## Methods

```ts
apply(command: DocumentCommand): void;
load(snapshot: PixelDocumentSnapshot, owns?: (regionId: string) => boolean): void;
removeNormalMapZoneOf(regionId: string): IndexedNormalMapZone | null;

interface PixelDocumentSnapshot {
  size: Vec2;
  pixels: Uint8ClampedArray;
  uvRegions?: Iterable<UVRegion | UVRegionData>;
  normalMap?: NormalMapData | null;
}
```

`apply` mutates the state as described in [`PixelCommand`](./PixelCommand.md#applying). `load` replaces the pixels, the regions `owns` accepts (every region by default) and the normal map settings; a snapshot without `normalMap` turns the feature off. `removeNormalMapZoneOf` drops a region's zone and returns it with its index, or `null`.

[Serialization](./serialization/index.md) reads and writes a state.
