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
    onChange?: (state: HistoryState) => void;
  };
  onBufferUpdated?: PixelBufferHookListener;
}
```

`init` is drawn over the filled buffer and sets its size.

## Properties

```ts
readonly buffer: CanvasBuffer;
readonly uv: UVMap;
readonly history: History;
onBufferUpdated: PixelBufferHookListener | undefined;
```

`onBufferUpdated` receives every local command, including undo and redo replay. Remote commands and snapshots never reach it.

## Events

| Event | Payload | When |
|---|---|---|
| `changed` | `{ bounds }` | pixels were written |
| `resized` | `{ size }` | the texture was resized |
| `replaced` | `{ size }` | all pixels were replaced (texture load, remote replace, snapshot, history) |
| `draw-end` | none | a stroke, fill or selection edit landed, local or remote, and after undo or redo |
| `history-changed` | `HistoryState` | the history stack changed |
| `reset` | none | a remote resize, texture replacement or snapshot replaced the texture; views drop transient state such as a floating selection |

## Queries

```ts
size(): Vec2;
hasTransparency(geometry: UVGeometry): boolean;
```

`hasTransparency` reports whether any pixel inside the geometry has alpha below 255. Triangle and compound shapes test pixel centers.

## Edits

```ts
commitStroke(pixels: Vec2[], color: RGBA8, beforeColors: RGBA8[]): void;
commitPixels(pixels: Vec2[], color: RGBA8, uniformBeforeColor?: RGBA8): void;
commitGlobalFill(commit: FillGlobalCommit): void;
commitSelectionEdit(entry: SelectEditEntry): void;
resize(size: Vec2): void;
replaceTexture(source: HTMLCanvasElement | HTMLImageElement): void;
clearTexture(keepMask?: Uint8Array): void;
undo(): HistoryEntry | null;
redo(): HistoryEntry | null;
```

`commitStroke` records pixels already written to the buffer; `commitPixels` writes them first. Each records history and emits one `onBufferUpdated` command.

## Remote state

```ts
applyRemoteCommand(event: PixelBufferHookEvent): void;
loadSnapshot(
  size: Vec2,
  pixels: Uint8ClampedArray,
  uvRegions?: (UVRegion | UVRegionData)[]
): void;
runLocalRestore<T>(fn: () => T): T;
```

Remote commands mutate the document without recording history or echoing a command. A remote resize or texture replacement clears history, and `loadSnapshot` replaces pixels and UV regions and clears history. `runLocalRestore` runs `fn` with the same suppression, for restoring state that must not be broadcast.
