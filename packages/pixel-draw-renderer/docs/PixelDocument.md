# PixelDocument

The texture buffer, UV map and history of one pixel-art texture, without any view. A network client can keep it in sync with no canvas mounted, and several [`PixelArtCanvas`](./PixelArtCanvas.md) instances can edit the same document through the `document` option.

```ts
const doc = new PixelDocument({
  size: { x: 64, y: 32 },
  history: { enabled: true }
});

const canvas = new PixelArtCanvas(parent, { document: doc });
```

## Constructor

```ts
interface PixelDocumentOptions {
  size: Vec2;
  defaultColor?: ByteColorInput;
  maxSize?: number;
  init?: HTMLCanvasElement;
  history?: {
    enabled?: boolean;
    limit?: number;
  };
}
```

`init` is drawn over the filled buffer and sets its size.

## Properties

```ts
readonly buffer: CanvasBuffer;
readonly uv: UVMap;
readonly history: History;
readonly palette: ColorPalette;
```

## Palette

`palette` holds the document's ten [saved colors](./ColorPalette.md).
`changePaletteColor(index: number, color: RGBA8): void` changes one slot,
records undo/redo when history is enabled, and emits a document command.
Unchanged colors are ignored. Invalid indices or channels throw before any
state, command or history change.

## UV ownership

```ts
type UVRegionFilter = (id: string) => boolean;

disownUvRegions(filter: UVRegionFilter): () => void;
ownsUvRegion(id: string): boolean;
```

The document owns every UV region until `disownUvRegions` hands the ones `filter` matches to another document; calling the returned function takes them back. Several filters can be active at once. A disowned region stays editable, but its changes emit no command and record no history, and remote UV commands and snapshot regions with its id are ignored. Snapshots keep it in place. Owned regions and pixel edits are unaffected.

## Events

| Event | Payload | When |
|---|---|---|
| `command` | [`PixelCommand`](./PixelCommand.md) | a local edit, undo or redo produced a command; remote commands and snapshots never emit it |
| `palette-changed` | `number \| null` | one palette slot changed, or a snapshot replaced the whole palette (`null`); includes remote changes and undo/redo |
| `changed` | `{ bounds }` | pixels were written |
| `resized` | `{ size }` | the texture was resized |
| `replaced` | `{ size }` | all pixels were replaced (texture load, remote replace, snapshot, history) |
| `draw-end` | none | a stroke, fill or selection edit landed, local or remote, and after undo or redo |
| `history-changed` | `HistoryState` | the history stack changed; after an undo or redo, once every command of the entry is applied |
| `islands-changed` | none | the [`islands`](#normal-map) map is out of date |
| `normal-map-changed` | `{ config, regionIds }` | the normal map settings changed, locally or remotely; `regionIds` lists the regions whose zone changed, `null` when every island is affected |
| `reset` | none | a remote resize, texture replacement or snapshot replaced the texture; views drop transient state such as a floating selection |

## Queries

```ts
size(): Vec2;
hasTransparency(geometry: UVGeometry): boolean;
```

`hasTransparency` reports whether any pixel inside the geometry has alpha below 255. Triangle and compound shapes test pixel centers.

## Edits

```ts
paintPixels(pixels: Vec2[], color: RGBA8, beforeColor?: RGBA8): void;
paintGlobalFill(fill: GlobalFill): void;
recordStroke(pixels: Vec2[], color: RGBA8, beforeColors: RGBA8[]): void;
paintSelectionEdit(edit: SelectionEdit): void;
resize(size: Vec2): void;
replaceTexture(source: HTMLCanvasElement | HTMLImageElement): void;
clearTexture(keepMask?: Uint8Array): void;
undo(): HistoryEntry | null;
redo(): HistoryEntry | null;

interface GlobalFill {
  positions: Vec2[];
  fromColor: RGBA8;
  toColor: RGBA8;
}

interface SelectionEdit {
  positions: Vec2[];
  beforeColors: RGBA8[];
  afterColors: RGBA8[];
  before: SelectionFootprint;
  after: SelectionFootprint;
}
```

`paint*` methods write the pixels, then record them. `recordStroke` records pixels the brush already wrote to the buffer. `paintSelectionEdit` writes `afterColors` at `positions` and keeps both footprints in the history entry so undo and redo can restore the selection. Each edit records one [history entry](./history/HistoryStack.md#entries) and emits its commands. `paintPixels` ignores an empty list; pass `beforeColor` when every pixel had that color, which skips sampling them. `paintGlobalFill` paints `positions` and emits one `global-fill` command; every receiver recolors the pixels of `fromColor` itself.

`resize` emits `resized`. Its history entry holds the texture before and after, so undo and redo restore the exact pixels and emit `texture-replaced`.

`undo` and `redo` apply the entry's commands through the same path as remote commands, emit them with `originTimestamp` set to the entry's timestamp, emit `draw-end`, then `history-changed`.

## Normal map

```ts
readonly normalMap: NormalMapConfig | null;
readonly normals: NormalMap;
readonly islands: IslandMap;

useIslandFaces(faces: () => Iterable<IslandFace>): () => void;
invalidateIslands(): void;

enableNormalMap(config?: NormalMapConfig): void;
disableNormalMap(): void;
patchNormalMapDefaults(patch: Partial<NormalMapSettings>): void;
setNormalMapZone(zone: NormalMapZone): void;
deleteNormalMapZone(regionId: string): void;
```

`normalMap` holds the committed [settings](./normal/NormalMapConfig.md), `null` while the feature is off. `normals` is the generated [`NormalMap`](./normal/NormalMap.md), created on first access and idle until retained. To show settings while a slider is dragged, use [`normals.preview()`](./normal/NormalMap.md#preview) and commit on release.

`islands` is the [island map](./normal/IslandMap.md) of the UV regions, built on first access and kept until a region is created, deleted, moved, rotated or changes state, or the texture is resized or replaced. Each of these emits `islands-changed`, and the next read rebuilds the map. `normals` reads its islands from here.

`useIslandFaces` builds the islands from the given faces instead of the UV regions, for a host that places its faces itself, such as a voxel tileset. Region changes then leave the islands alone: the host calls `invalidateIslands` when its faces change, and a resize or replace still rebuilds them. The returned function goes back to the UV regions, unless another `useIslandFaces` call replaced these faces since.

Each edit records one history entry and emits one [command](./normal/NormalMapConfig.md#commands). `enableNormalMap` defaults to `NormalMapConfig.create()`. A defaults patch sends only the patched fields. Patches and zone edits are ignored while the feature is off. An invalid setting throws `InvalidNormalMapSettingsError` and records nothing.

Deleting a UV region the document owns removes its zone in the same history entry, and undo restores both. An external region keeps its zone, which the generator ignores while the region is missing.

## Remote state

```ts
applyRemoteCommand(command: PixelCommand): void;
loadSnapshot(
  size: Vec2,
  pixels: Uint8ClampedArray,
  uvRegions?: (UVRegion | UVRegionData)[],
  normalMap?: NormalMapData | null,
  palette?: readonly RGBA8[]
): void;
runLocalRestore<T>(fn: () => T): T;
```

Remote commands mutate the document without recording history or emitting `command`. They are applied by the document's [state](./PixelDocumentState.md), the same applier a headless server uses. A remote resize or texture replacement clears history, and `loadSnapshot` replaces pixels, UV regions and normal map settings and clears history. A snapshot without `normalMap` turns the feature off. `runLocalRestore` runs `fn` with the same suppression, for restoring state that must not be broadcast: edits made inside it record no history and emit no command, undo and redo included.
