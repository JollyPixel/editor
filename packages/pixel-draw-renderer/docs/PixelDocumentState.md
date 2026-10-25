# PixelDocumentState

The pixels, UV map, saved UV nets and normal map settings of a pixel document, without history, events or DOM. It is the one place [commands](./PixelCommand.md) are applied: a [`PixelDocument`](./PixelDocument.md) applies remote commands, undo and redo through its own state, and a server folds a room's commands into a headless one.

```ts
const state = new PixelDocumentState({
  buffer: new PixelBuffer({ size: { x: 32, y: 32 } })
});

state.apply(toPixelDocumentCommand(command));
```

## Constructor

```ts
interface PixelDocumentStateOptions<TBuffer extends DefaultPixelBuffer> {
  buffer: TBuffer;
  onNormalMapChanged?: (regionIds: string[] | null) => void;
  onPaletteChanged?: (index: number | null) => void;
  onUvNetsChanged?: () => void;
  uv?: Omit<UVMapOptions, "getCanvasSize">;
}
```

`TBuffer` defaults to [`PixelBuffer`](./buffer/PixelBuffer.md). `onNormalMapChanged` receives the regions whose zone changed, or `null` when the whole configuration changed. `uv` is passed to the [`UVMap`](./uv/UVMap.md#types) constructor; its canvas size always comes from `buffer`.

## Properties

```ts
readonly buffer: TBuffer;
readonly uv: UVMap;
readonly normalMap: NormalMapConfig | null;
readonly palette: ColorPalette;
readonly uvNets: UVNetSet;
```

`uv` is a [`UVMap`](./uv/UVMap.md) sized by `buffer`.

## Methods

```ts
apply(command: PixelDocumentCommand): void;
load(snapshot: PixelDocumentSnapshot, owns?: (regionId: string) => boolean): void;
removeNormalMapZone(regionId: string): IndexedNormalMapZone | null;

interface PixelDocumentSnapshot {
  size: Vec2;
  pixels: Uint8ClampedArray;
  uvRegions?: Iterable<UVRegion | UVRegionData>;
  normalMap?: NormalMapData | null;
  palette?: readonly RGBA8[];
  uvNets?: UVNetSetData;
}
```

`apply` mutates the state as described in [`PixelCommand`](./PixelCommand.md#applying). `load` replaces the pixels, the regions `owns` accepts (every region by default) and the normal map settings; a snapshot without `normalMap` turns the feature off. `removeNormalMapZone` drops a region's zone and returns it with its index, or `null`.

[Serialization](./serialization/index.md) reads and writes a state.

`palette` is an immutable [ColorPalette](./ColorPalette.md). A slot command
calls `onPaletteChanged` with its index when its color changes. Loading a
snapshot replaces the palette and calls the listener with `null`. A missing
palette loads the defaults, including when replacing an already edited state.

`uvNets` is an immutable [UVNetSet](./uv/UVNetSet.md). The UV net commands
call `onUvNetsChanged` when they change it. Loading a snapshot replaces it and
calls the listener, unless an empty set stays empty. A snapshot without
`uvNets` loads an empty set.
