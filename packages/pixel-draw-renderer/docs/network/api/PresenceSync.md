# Presence sync

Four client helpers publish local preview state and draw remote state on a `PixelArtCanvas`. They use one shared `Room<PixelNetworkCommand, PixelServerMessage>`.

## PixelCursorSync

Publishes cursor coordinates and renders peer cursor markers.

### Constructor

```ts
new PixelCursorSync(options: PixelCursorSyncOptions)

interface PixelCursorSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  getLabel?: (identity: PeerMetadata) => string | undefined;
}
```

`getLabel` reads `identity.username` when omitted.

`attach()` chains the existing `canvas.onCursorMove` callback, publishes changed coordinates and seeds cursors already stored in `room.peers`. A `null` coordinate hides the local cursor on remote clients.

## PixelStrokeGhostSync

Publishes the full pixel set of an in-progress brush or line gesture.

### Constructor

```ts
new PixelStrokeGhostSync(options: PixelStrokeGhostSyncOptions)

interface PixelStrokeGhostSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  enableGhostPreview?: boolean;
}
```

`enableGhostPreview` defaults to `true`. When enabled, `attach()` chains `canvas.onStrokeProgress`. Updates are coalesced to one presence message per animation frame.

An accepted stroke removes ghosts at overlapping positions. Resize, texture replacement, global fill and snapshots clear every stroke ghost. Inactive ghosts expire after 1.5 seconds.

## UVGhostSync

Publishes in-progress UV region geometry and renders it as a peer-colored border.

### Constructor

```ts
new UVGhostSync(options: UVGhostSyncOptions)

interface UVGhostSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  enableGhostPreview?: boolean;
}
```

`enableGhostPreview` defaults to `true`. The helper listens to `"region-dragging"` and cancels a queued update when the same region emits `"region-moved"`.

Accepted move, delete and state-change commands remove ghosts for the affected region. Snapshots clear all UV ghosts. Inactive ghosts expire after 1.5 seconds.

## SelectionGhostSync

Publishes selection geometry during creation and movement. Remote clients render a boundary plus floating content for moving selections.

### Constructor

```ts
new SelectionGhostSync(options: SelectionGhostSyncOptions)

interface SelectionGhostSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  enableGhostPreview?: boolean;
}
```

`enableGhostPreview` defaults to `true`.

```ts
type SelectionGhostPayload =
  | {
      phase: "creating";
      rect: SelectionRect;
    }
  | {
      phase: "moving";
      sourceRect: SelectionRect;
      liveRect: SelectionRect;
      mask: boolean[];
      blankSource: boolean;
    };
```

The helper listens to `canvas.selectionEvents`. `"selection-committed"` cancels queued preview data before the command arrives. `"selection-idle"` sends an explicit `null` presence value.

Accepted selection edits remove ghosts that overlap the edited pixels. Resize, texture replacement, global fill and snapshots clear every selection ghost. Inactive ghosts expire after 1.5 seconds.

## Shared methods

Each helper exposes the same lifecycle methods:

```ts
attach(canvas: PixelArtCanvas): void
detach(): void
destroy(): void
```

### `attach(canvas)`

Attaches one canvas and seeds valid preview values already stored in `room.peers`. Calling it again before `detach()` throws.

### `detach()`

Stops local publishing, cancels scheduled sends and clears remote overlays managed by the helper. Cursor and stroke helpers restore callbacks that existed before attachment.

### `destroy()`

Calls `detach()` and removes the helper's room listeners. It does not leave the room.

## Presence fields

Presence values are untyped `PeerMetadata` at the transport boundary. Each helper ignores patches without its field and rejects malformed values for its own field.

| Helper | Field | Value |
|---|---|---|
| `PixelCursorSync` | `cursor` | `Vec2 | null` |
| `PixelStrokeGhostSync` | `strokeGhost` | `PeerStrokePixel[]` |
| `UVGhostSync` | `uvGhost` | `UVGhostPayload` |
| `SelectionGhostSync` | `selectionGhost` | `SelectionGhostPayload | null` |
