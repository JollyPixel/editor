# PixelDocument

The texture buffer, UV map and normal map settings of one pixel-art texture, without any view. A network client can keep it in sync with no canvas mounted, and several [`PixelArtCanvas`](./PixelArtCanvas.md) instances can edit the same document through the `document` option. It emits a change for each edit, which [pixel history](./history/PixelHistory.md) records.

```ts
const doc = new PixelDocument({
  size: { x: 64, y: 32 }
});

const canvas = new PixelArtCanvas(parent, {
  document: doc
});
```

## Constructor

```ts
interface PixelDocumentOptions {
  size: Vec2;
  defaultColor?: ByteColorInput;
  maxSize?: number;
  init?: HTMLCanvasElement;
}
```

`init` is drawn over the filled buffer and sets its size.

## Properties

```ts
readonly buffer: CanvasBuffer;
readonly uv: UVMap;
readonly palette: ColorPalette;
```

## Palette

`palette` holds the document's ten [saved colors](./ColorPalette.md).
`changePaletteColor(index: number, color: RGBA8): void` changes one slot,
emits a change and a document command.
Unchanged colors are ignored. Invalid indices or channels throw before any
state, change or command.

## UV ownership

```ts
type UVRegionFilter = (id: string) => boolean;

disownUvRegions(filter: UVRegionFilter): () => void;
ownsUvRegion(id: string): boolean;
```

The document owns every UV region until `disownUvRegions` hands the ones `filter` matches to another document; calling the returned function takes them back. Several filters can be active at once. A disowned region stays editable, but its changes emit no change and no command, and remote UV commands and snapshot regions with its id are ignored. Snapshots keep it in place. Owned regions and pixel edits are unaffected.

## Events

| Event | Payload | When |
|---|---|---|
| `change` | `PixelChange` | a command applied: a local edit, undo or redo (`origin` `local`), a peer's command (`remote`, naming its `clientId`) or this client's pending command replayed (`replay`) |
| `command` | [`PixelCommand`](./PixelCommand.md), `PixelChange` | a local edit, undo or redo produced a command, after its `change`; remote commands and snapshots never emit it |
| `palette-changed` | `number \| null` | one palette slot changed, or a snapshot replaced the whole palette (`null`); includes remote changes and undo/redo |
| `changed` | `{ bounds }` | pixels were written |
| `resized` | `{ size }` | the texture was resized |
| `replaced` | `{ size }` | all pixels were replaced (texture load, remote replace, snapshot, history) |
| `draw-end` | none | a stroke, fill or selection edit landed, local or remote, and after undo or redo |
| `islands-changed` | none | the [`islands`](#normal-map) map is out of date |
| `normal-map-changed` | `{ config, regionIds }` | the normal map settings changed, locally or remotely; `regionIds` lists the regions whose zone changed, `null` when every island is affected |
| `reset` | `"load"` | a snapshot replaced the document |

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
batch<T>(edit: () => T): T;
groupEditsWith(grouping: EditGrouping): () => void;

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

`paint*` methods write the pixels, then record them. `recordStroke` records pixels the brush already wrote to the buffer. `paintSelectionEdit` writes `afterColors` at `positions`; the canvas records the footprints in the same history step. Each edit emits one `change`, carrying the commands that undo it, and one command. `paintPixels` ignores an empty list; pass `beforeColor` when every pixel had that color, which skips sampling them. `paintGlobalFill` paints `positions` and emits one `global-fill` command, every receiver recoloring the pixels of `fromColor` itself; its change carries the equivalent `stroke`.

`resize` emits `resized`. Its change holds the texture before it, so undo and redo restore the exact pixels and emit `texture-replaced`.

`batch` runs `edit` as one history step when a grouping is set: `groupEditsWith` sets it, usually to `(edit) => history.record(scope, null, edit)`, and returns a function that removes it. Without one, `batch` just calls `edit`. `registerPixelHistory` from `@jolly-pixel/asset.pixel-art` sets it.

## Changes

```ts
type PixelChange = EditChange<DocumentCommand>;

applyStep(command: DocumentCommand): PixelChange | null;
```

`applyStep` applies an undo or redo command as a local edit: it emits the change, with the commands undoing it read before it applied, then the command and `draw-end`. It returns `null` and changes nothing when the command no longer applies, such as a move of a deleted UV region. See [pixel history](./history/PixelHistory.md#editchange).

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

`useIslandFaces` builds the islands from the given faces instead of the UV regions, for a host that places its faces itself, such as a voxel blockset. Region changes then leave the islands alone: the host calls `invalidateIslands` when its faces change, and a resize or replace still rebuilds them. The returned function goes back to the UV regions, unless another `useIslandFaces` call replaced these faces since.

Each edit emits one change and one [command](./normal/NormalMapConfig.md#commands). `enableNormalMap` defaults to `NormalMapConfig.create()`. A defaults patch sends only the patched fields. Patches and zone edits are ignored while the feature is off. An invalid setting throws `InvalidNormalMapSettingsError` and records nothing.

Deleting a UV region the document owns removes its zone in the same change, and undo restores both. An external region keeps its zone, which the generator ignores while the region is missing.

## Remote state

```ts
applyRemoteCommand(command: PixelCommand, clientId?: string | null): void;
replayPendingCommand(command: PixelCommand): void;
loadSnapshot(
  size: Vec2,
  pixels: Uint8ClampedArray,
  uvRegions?: (UVRegion | UVRegionData)[],
  normalMap?: NormalMapData | null,
  palette?: readonly RGBA8[]
): void;
runLocalRestore<T>(fn: () => T): T;
```

Remote commands mutate the document and emit a `remote` change naming `clientId`, but no `command`. They are applied by the document's [state](./PixelDocumentState.md), the same applier a headless server uses. `replayPendingCommand` applies this client's pending command again after a peer's, as a `replay` change; a sync client's reconciler calls it. `loadSnapshot` replaces pixels, UV regions and normal map settings and emits `reset` with `"load"`. A snapshot without `normalMap` turns the feature off. `runLocalRestore` runs `fn` without recording, for restoring state that must not be broadcast: edits made inside it emit no change and no command.
