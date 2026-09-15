# Presence sync

Four client helpers publish local preview state and draw remote state on a `PixelArtCanvas`. They share one `Room<PixelNetworkCommand, PixelServerMessage>` and read presence through `network.PresenceChannel`.

Each helper takes its canvas in the constructor and exposes one method:

```ts
destroy(): void
```

`destroy()` restores the canvas callbacks it replaced, removes its listeners and clears the overlays it drew. It does not leave the room.

## PixelCursorSync

Publishes cursor coordinates and renders peer cursor markers.

```ts
new PixelCursorSync(options: PixelCursorSyncOptions)

interface PixelCursorSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
  label?: (profile: PeerMetadata) => string | undefined;
  color?: (clientId: string, profile: PeerMetadata) => string;
}
```

`label` reads `profile.username` when omitted. `color` falls back to a deterministic color keyed on the peer's `clientId`.

The helper chains `canvas.onCursorMove` and publishes changed coordinates. A `null` coordinate hides the local cursor on remote clients.

## PixelStrokeGhostSync

Publishes the full pixel set of an in-progress brush or line gesture.

```ts
new PixelStrokeGhostSync(options: {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
})
```

The helper chains `canvas.onStrokeProgress`. An empty progress cancels the queued update.

An accepted stroke removes ghosts at overlapping positions. Resize, texture replacement, global fill and snapshots clear every stroke ghost.

## UVGhostSync

Publishes in-progress UV region geometry and renders it as a peer-colored border.

```ts
new UVGhostSync(options: {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
})
```

The helper listens to `"region-dragging"`, cancels a queued update when the same region emits `"region-moved"`, and publishes `null` when a drag ends uncommitted.

Accepted move, delete and state-change commands remove ghosts for the affected region. Snapshots clear all UV ghosts.

## SelectionGhostSync

Publishes selection geometry during creation and movement. Remote clients render a boundary plus floating content for moving selections.

```ts
new SelectionGhostSync(options: {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
})

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

The helper listens to `canvas.selectionEvents`. `"selection-committed"` cancels queued preview data before the command arrives. `"selection-idle"` publishes `null`.

Accepted selection edits remove ghosts that overlap the edited pixels. Resize, texture replacement, global fill and snapshots clear every selection ghost.

## Ghost streams

Stroke, UV and selection helpers are built on `PeerGhostStream`:

- local updates are coalesced to one presence message per animation frame;
- a remote ghost expires after 1.5 seconds without an update;
- `null`, a malformed value or `peer-left` removes a peer ghost;
- a snapshot clears every ghost.

## Presence fields

| Helper | Field | Value |
|---|---|---|
| `PixelCursorSync` | `cursor` | `Vec2 \| null` |
| `PixelStrokeGhostSync` | `strokeGhost` | `PeerStrokePixel[]` |
| `UVGhostSync` | `uvGhost` | `UVGhostPayload \| null` |
| `SelectionGhostSync` | `selectionGhost` | `SelectionGhostPayload \| null` |

A malformed `cursor` removes that peer cursor.
