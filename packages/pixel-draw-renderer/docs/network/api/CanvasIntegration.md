# PixelArtCanvas network integration

`PixelArtCanvas` exposes mutation hooks and remote-application methods for `PixelSyncClient`. Presence helpers use the same callbacks, typed events and peer overlays.

Most applications should use the provided sync classes. These members are useful when adapting another transport or adding application-specific presence.

## Mutation hook

### `onBufferUpdated`

```ts
get onBufferUpdated(): PixelBufferHookListener | undefined
set onBufferUpdated(listener: PixelBufferHookListener | undefined)
```

Receives committed local pixel and UV commands. Undo and redo emit replay commands with the original edit time in `originTimestamp`.

The canvas has one callback slot. Read the current callback before replacing it when multiple consumers need the hook. `PixelSyncClient` follows this rule and restores the previous callback when detached.

The callback can also be supplied as [`PixelArtCanvasOptions.onBufferUpdated`](../../PixelArtCanvasOptions.md#onbufferupdated).

### Mutation commands

| Action | Metadata |
|---|---|
| `"stroke"` | `color`, `positions` |
| `"resized"` | `size` |
| `"texture-replaced"` | `size`, base64 `pixels` |
| `"global-fill"` | `fromColor`, `toColor` |
| `"select-edit"` | Per-position `positions`, `colors` |
| `"uv-region-created"` | Full `region` |
| `"uv-region-deleted"` | `id` |
| `"uv-region-moved"` | `id`, `face`, `rect` |
| `"uv-region-state-changed"` | Full `region` |

## Remote application

### `applyRemoteCommand(event)`

```ts
applyRemoteCommand(event: PixelBufferHookEvent): void
```

Applies one command without calling `onBufferUpdated`. Remote resize and texture-replacement commands clear local history.

### `loadSnapshot(size, pixels, uvRegions?)`

```ts
loadSnapshot(
  size: Vec2,
  pixels: Uint8ClampedArray,
  uvRegions?: (UVRegion | UVRegionData)[]
): void
```

Replaces the texture and UV regions without broadcasting a command. It clears local history.

## Presence callbacks

### `onCursorMove`

```ts
get onCursorMove(): ((pos: Vec2 | null) => void) | undefined
set onCursorMove(listener: ((pos: Vec2 | null) => void) | undefined)
```

Reports bounded texture coordinates for canvas pointer movement. It reports `null` when the pointer leaves the canvas or texture.

### `onStrokeProgress`

```ts
get onStrokeProgress():
  ((pixels: PeerStrokePixel[]) => void) | undefined
set onStrokeProgress(
  listener: ((pixels: PeerStrokePixel[]) => void) | undefined
)
```

Reports the current brush or line pixels before commit. Fill operations do not report progress pixels.

Cursor and stroke helpers chain callbacks already assigned to these slots and restore them on detach.

### `selectionEvents`

```ts
readonly selectionEvents: Pick<
  Emitter<SelectEngineEvent>,
  "on" | "off"
>
```

Provides subscription-only access to `"selection-progress"`, `"selection-committed"` and `"selection-idle"`.

## Peer presence

```ts
readonly peerPresence: PeerPresence
```

`peerPresence` groups the remote cursor, stroke, UV and selection previews. The provided presence sync helpers manage it. Custom transports can use its `cursors`, `strokes`, `uv`, `selectionOutlines` and `floatingSelections` members directly.

Presence state is visual only. It does not change the texture, UV map, local selection or history.
