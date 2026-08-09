# SelectionGhostSync

Broadcasts the local in-progress selection (drawing a new marquee/shape, or dragging an existing one) and renders remote peers' selections on `PixelArtCanvas.peerSelectionGhosts` (a dashed, per-peer-colored boundary) and, while a peer is moving a selection, `PixelArtCanvas.peerFloatingSelectionGhosts` (the vacated source blanked and the moved content redrawn at its live position, so there's no visible "duplicate").

Purely ephemeral: never touches selection state or history. A peer's ghost is cleared the moment any authoritative `select-edit` command from them arrives (or the whole document is replaced by a snapshot), the instant a creation-only gesture finishes locally (it never produces a command, so nothing would otherwise reconcile it), or after ~1.5s of inactivity.

The sync layer owns one per-client inactivity lease for both rendering overlays, so the boundary and floating content expire together.

No server extension needed: presence is relayed by `network.Room` itself (`updatePresence`/`onPeerPresence`), independent of `PixelSyncServer`. Reuse the same room a `PixelSyncClient` already has open.

## Why This Isn't PixelStrokeGhostSync

`SelectController` reports its own progress through a dedicated emitter (`PixelArtCanvas.selectionEvents`), not the shared `onStrokeProgress` hook brush/line use. The payload is **geometry**, not pixel colors:

```ts
type SelectionGhostPayload =
  | { phase: "creating"; rect: SelectionRect }
  | {
      phase: "moving";
      sourceRect: SelectionRect;
      liveRect: SelectionRect;
      mask: boolean[];
      blankSource: boolean;
    };
```

The move hasn't committed, so a receiving peer's own `CanvasBuffer` still holds the exact pixels the mover's does at `sourceRect`. Sampling locally (like the local user's own `FloatingSelectionOverlay` already does) is both cheaper and more accurate than streaming a color array every frame. `blankSource` rides along because it depends on prior gesture history (a just-pasted or just-deleted selection skips blanking its non-existent source); it isn't derivable from geometry alone.

## Types Used By SelectionGhostSync

```ts
new SelectionGhostSync(options: SelectionGhostSyncOptions)

interface SelectionGhostSyncOptions {
	room: network.Room<PixelNetworkCommand, PixelServerMessage>;
	enableGhostPreview?: boolean; // default true
}
```

`network.Client.room()` from `@jolly-pixel/network` is the very same object `PixelSyncClient` uses for buffer sync; pass it to both.

## Use It Like This

```ts
import {
  PixelSyncClient,
  SelectionGhostSync
} from "@jolly-pixel/pixel-draw.renderer";

const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>("pixel-draw:main");
room.join();

const syncClient = new PixelSyncClient({ room });
syncClient.attach(canvas);

const selectionGhostSync = new SelectionGhostSync({ room });
selectionGhostSync.attach(canvas);

// Later
selectionGhostSync.destroy();
```

Set `enableGhostPreview: false` to disable the feature entirely: a no-op `attach()` that never wires the send hook or touches `canvas.peerSelectionGhosts`/`canvas.peerFloatingSelectionGhosts`, for bandwidth-constrained sessions:

```ts
new SelectionGhostSync({ room, enableGhostPreview: false });
```

## What It Does

1. Watches `canvas.selectionEvents`' `"selection-progress"` event and, at most once per animation frame, sends the current geometry via `room.updatePresence({ selectionGhost: payload })`. A full snapshot each tick, not a delta.
2. On `"selection-committed"` (a move's `select-edit` command is already on its way), drops any pending pre-commit tick instead of letting it resurrect a ghost peers are about to see cleared via reconciliation.
3. On `"selection-idle"` (a creation, or a no-op move, that will never produce a command), immediately sends an explicit clear (`updatePresence({ selectionGhost: null })`) instead of leaving peers to wait out the stale timeout.
4. On `"peer-presence"`, mirrors a peer's selection onto `canvas.peerSelectionGhosts` (always) and `canvas.peerFloatingSelectionGhosts` (only for `"moving"`; a `"creating"` update explicitly clears any stale floating ghost, since a brand-new marquee has no source footprint to blank).
5. On `"peer-left"`, removes that peer's ghost from both overlays.
6. On an incoming authoritative `"command"` from a peer, clears both overlays by pixel overlap with the command's affected positions, not by `clientId` (see [PixelStrokeGhostSync](./PixelStrokeGhostSync.md) for why).
7. On an incoming `"snapshot"`, clears every peer's ghost from both overlays.
8. Registers its own `"peer-left"`/`"peer-presence"`/`"message"` listeners via `room.on`: since `Room` supports multiple listeners per event, this never clobbers other code listening on the same room.

## Lifecycle

### `attach(canvas)`

- Attaches exactly one canvas.
- Throws if you call `attach` twice without `detach`.

### `detach()`

- Stops local progress broadcasts and cancels any pending animation-frame-scheduled send.
- Clears both remote peer ghost overlays and cancels their pending inactivity leases.

### `destroy()`

- Calls `detach()`.
- Removes its own `"peer-left"`/`"peer-presence"`/`"message"` listeners via `room.off`; other listeners on the room are untouched.

## Common Mistakes

1. Building a second `network.Client`/room for selection ghost streaming instead of reusing the sync one.
2. Expecting a peer's shape-select (magic-wand) click to stream a `"creating"` progress event: it resolves instantly (no drag phase), so it goes straight from nothing to a `"selection-idle"` clear.
