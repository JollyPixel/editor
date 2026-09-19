# Add presence previews

Presence previews show work before it commits. They share the room used by `PixelSyncClient`; no additional server extension or socket is needed.

## Create previews

`PixelCollaboration` already creates every preview. Build them yourself only when the editor needs a subset:

```ts
import {
  PixelCursorSync,
  PixelStrokeGhostSync,
  PixelSyncClient,
  SelectionGhostSync,
  UVGhostSync
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

const sync = new PixelSyncClient({ room, document: canvas.document });
const presence = [
  new PixelCursorSync({ room, canvas, label, color }),
  new PixelStrokeGhostSync({ room, canvas }),
  new SelectionGhostSync({ room, canvas, color }),
  new UVGhostSync({ room, canvas, color })
];

room.join();
```

Each helper replays the presence already stored in `room.peers` when it is constructed, so it can be created before or after the join.

## Preview behavior

| Helper | Local source | Presence field | Remote display |
|---|---|---|---|
| `PixelCursorSync` | `canvas.onCursorMove` | `cursor` | Cursor position and optional label |
| `PixelStrokeGhostSync` | `canvas.onStrokeProgress` | `strokeGhost` | Brush and line pixels before commit |
| `UVGhostSync` | `canvas.uv` drag events | `uvGhost` | Dashed UV region geometry |
| `SelectionGhostSync` | `canvas.selectionEvents` | `selectionGhost` | Selection boundary and moving content |

Stroke, UV and selection updates are coalesced to one full presence payload per animation frame. They send the current preview, not a delta.

Cursor positions are deduplicated. `label` and `color` (both `(clientId, profile)`) are required on `PixelCursorSync`, and `color` on `SelectionGhostSync` and `UVGhostSync`. Pass the same pair everywhere so a peer keeps one name and color across previews.

## Reconciliation and expiry

Previews never alter `PixelBuffer`, `UVMap`, selection state or history. Each client reconciles them against authoritative messages:

| Preview | Cleared when |
|---|---|
| Stroke | An accepted stroke overlaps its pixels; resize, texture replacement, global fill or snapshot clears all stroke ghosts |
| UV | An accepted move, delete or state change affects the same region; snapshots clear all UV ghosts |
| Selection | An accepted selection edit overlaps its pixels; resize, texture replacement, global fill or snapshot clears all selection ghosts |
| Cursor | The peer reports a malformed value, leaves the room, or the helper is destroyed |

Stroke, UV and selection ghosts also expire after 1.5 seconds without another update. Selection gestures and cancelled UV drags publish `null` when they end without a command.

Selection moves send geometry and a mask. Receiving clients sample the moved pixels from their own synchronized buffer, which avoids sending a color array every frame.

## Teardown

```ts
for (const helper of presence) {
  helper.destroy();
}
sync.destroy();
room.leave();
networkClient.destroy();
```

Each helper restores the canvas callback it replaced and clears its overlays.
