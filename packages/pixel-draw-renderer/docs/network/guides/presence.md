# Add presence previews

Presence previews show work before it commits. They share the room used by `PixelSyncClient`; no additional server extension or socket is needed.

## Attach previews

Construct the helpers before joining so their room listeners are ready. Attach them after the initial snapshot; each helper then seeds preview state already stored in `room.peers`:

```ts
import {
  PixelCursorSync,
  PixelStrokeGhostSync,
  SelectionGhostSync,
  UVGhostSync
} from "@jolly-pixel/pixel-draw.renderer";

const cursorSync = new PixelCursorSync({ room });
const strokeSync = new PixelStrokeGhostSync({ room });
const selectionSync = new SelectionGhostSync({ room });
const uvSync = new UVGhostSync({ room });

const attachPresence = (): void => {
  sync.off("ready", attachPresence);
  cursorSync.attach(canvas);
  strokeSync.attach(canvas);
  selectionSync.attach(canvas);
  uvSync.attach(canvas);
};

if (sync.ready) {
  attachPresence();
}
else {
  sync.on("ready", attachPresence);
  room.join();
}
```

When this code runs before the room has joined, `sync.ready` is `false` and the `else` branch joins it. If the setup guide already joined the room and applied its snapshot, the helpers attach immediately.

Use only the helpers your editor needs. `enableGhostPreview: false` disables stroke, selection or UV preview wiring, though skipping construction is usually simpler.

## Preview behavior

| Helper | Local source | Presence field | Remote display |
|---|---|---|---|
| `PixelCursorSync` | `canvas.onCursorMove` | `cursor` | Cursor position and optional label |
| `PixelStrokeGhostSync` | `canvas.onStrokeProgress` | `strokeGhost` | Brush and line pixels before commit |
| `UVGhostSync` | `canvas.uv` drag events | `uvGhost` | Dashed UV region geometry |
| `SelectionGhostSync` | `canvas.selectionEvents` | `selectionGhost` | Selection boundary and moving content |

Stroke, UV and selection updates are coalesced to one full presence payload per animation frame. They send the current preview, not a delta. A later update replaces an earlier one.

Cursor positions are deduplicated. The default label comes from `identity.username`; pass `getLabel` to `PixelCursorSync` for another identity shape.

## Reconciliation and expiry

Previews never alter `PixelBuffer`, `UVMap`, selection state or history. Each client reconciles them against authoritative messages:

| Preview | Cleared when |
|---|---|
| Stroke | An accepted stroke overlaps its pixels; resize, texture replacement, global fill or snapshot clears all stroke ghosts |
| UV | An accepted move, delete or state change affects the same region; snapshots clear all UV ghosts |
| Selection | An accepted selection edit overlaps its pixels; resize, texture replacement, global fill or snapshot clears all selection ghosts |
| Cursor | The peer reports `null`, leaves the room, or the helper detaches |

Stroke, UV and selection ghosts also expire after 1.5 seconds without another update. Selection gestures send an explicit clear when they finish without a command. A canceled UV drag has no commit message, so remote clients keep it until the inactivity timer expires.

Selection moves send geometry and a mask. Receiving clients sample the moved pixels from their own synchronized buffer, which avoids sending a color array every frame.

## Teardown

Each helper owns only its listeners and overlays. Destroy all helpers before leaving the room:

```ts
cursorSync.destroy();
strokeSync.destroy();
selectionSync.destroy();
uvSync.destroy();

sync.destroy();
room.leave();
networkClient.destroy();
```

Cursor and stroke helpers preserve a callback that was already assigned to the corresponding canvas hook. `detach()` restores that callback.
