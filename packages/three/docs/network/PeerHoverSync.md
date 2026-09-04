# PeerHoverSync

`PeerHoverSync` publishes the local
[`SelectionManager`](../SelectionManager.md)'s hovered id to a room's
presence and applies every remote peer's published id into a
[`PeerHoverRegistry`](../PeerHoverRegistry.md) - the hover counterpart to
[`PeerSelectionSync`](./PeerSelectionSync.md), which this class otherwise
mirrors closely (room event wiring, peer lifecycle cleanup, no
local-identity stamping needed for peer color).

## Import

```ts
import {
  PeerHoverSync,
  type PeerHoverSyncOptions
} from "@jolly-pixel/three/network";
```

This entry point requires the optional `@jolly-pixel/network` peer dependency.

## Setup

```ts
import * as network from "@jolly-pixel/network/client";
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerHoverRegistry,
  PeerSelectionOverlays,
  PeerHoverOverlays
} from "@jolly-pixel/three";
import { PeerSelectionSync, PeerHoverSync } from "@jolly-pixel/three/network";

const client = new network.Client({ identity: { username } });
const room = client.room("my-room");
room.join();

const selection = new SelectionManager();
const selectionRegistry = new PeerSelectionRegistry();
const hoverRegistry = new PeerHoverRegistry();
const overlays = new PeerSelectionOverlays({ registry: selectionRegistry, selection });
const hoverOverlays = new PeerHoverOverlays({ selectionRegistry, hoverRegistry, selection });

const selectionSync = new PeerSelectionSync({ room, registry: selectionRegistry, selection });
const hoverSync = new PeerHoverSync({ room, registry: hoverRegistry, selection });

selection.hover("box-1"); // published to the room automatically, throttled
```

Call `destroy()` when the room or scene is torn down.

Everything downstream of `hoverRegistry` -
[`PeerHoverOverlays`](../PeerHoverOverlays.md),
[`PeerHighlightPass`](../PeerHighlightPass.md)'s own `hoverRegistry` option,
[`PeerSelectionVisibility`](../PeerSelectionVisibility.md)'s own
`hoverRegistry` option - is already transport-agnostic and needs no changes
to render real peer hovers; this class is only the network glue feeding
`hoverRegistry` from `room`.

## Constructor

```ts
new PeerHoverSync(options: PeerHoverSyncOptions)
```

The constructor subscribes to room events, applies every peer already known
to `room.peers`, and publishes the local hover's current value (`null` if
nothing is hovered yet).

```ts
interface PeerHoverSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  registry: PeerHoverRegistry;
  selection: SelectionManager;
  presenceKey?: string;
  throttleMs?: number;
  resyncIntervalMs?: number;
}
```

| Option | Default | Description |
|---|---|---|
| `room` | required | Room used to publish and receive hovers. |
| `registry` | required | Remote peer hovers read from the room are applied here. |
| `selection` | required | Local hover state published to the room. |
| `presenceKey` | `"hover"` | Presence field used for hovers. Set a different key for each hover stream in the same room. |
| `throttleMs` | `80` | Minimum delay between two presence updates, in milliseconds - see "Throttling" below. |
| `resyncIntervalMs` | `1000` | How often every currently connected peer's presence is re-applied from `room.peers` - same safety net as [`PeerSelectionSync`](./PeerSelectionSync.md#constructor)'s own option, for the same reason, but tighter: hover is a fast-moving, high-frequency stream where a multi-second-late correction is nearly as unhelpful as none at all (by then the cursor has usually moved on). Reconciling is a no-op per already-correct peer regardless of cadence, so there's no real cost to running it more often here. Set to `0` to disable. |

## Methods

### `destroy()`

```ts
destroy(): void
```

Unsubscribes from `room`/`selection`, clears any pending trailing flush (see
"Throttling" below), stops the periodic resync (see `resyncIntervalMs`
above), and removes every peer this instance applied to `registry` - mirrors
`PeerSelectionSync.destroy()`.

## Throttling

Unlike [`PeerFrustumSync`](./PeerFrustumSync.md)'s own `throttleMs` (which
relies on `update()` being polled every render tick, so a report the window
dropped is retried on the very next tick), `PeerHoverSync` is event-driven -
`SelectionManager`'s `hoverChange` fires once per hover enter/exit, not
continuously. A plain drop-on-window throttle would risk losing a hover
state permanently if no further hover change happens to arrive right after.

Instead, a report suppressed by the window is scheduled to flush at the
window's end (a trailing-edge debounce), with a later hover change before
that flush simply replacing the pending value rather than scheduling a
second timer. This guarantees the latest hover state is always eventually
published, even from a single, isolated hover change.

## Presence value

Hovers are stored under `presenceKey` as a plain string or `null`:

```ts
type PeerHoverId = string | null;
```

`null` means "this peer isn't hovering anything" - a known, valid state,
same as [`PeerSelectionId`](./PeerSelectionSync.md#presence-value)'s own
`null`. Use [`decodePeerHoverId`](index.md#hover-helpers) when reading the
same presence field elsewhere.

## Notes

- Every peer must register the same id for the same object under `SelectionManager`/its own local registry for a remote hover to resolve to anything visible - same one-time caveat `PeerSelectionSync`'s own doc comment states for selection.
- Publishes `selection.hovered` verbatim, even when it equals `selection.selected` or when some other object is already selected by a peer - suppressing a hover indicator when a selection is present is a rendering concern (see [`PeerHoverOverlays`](../PeerHoverOverlays.md)/[`PeerHighlightPass`](../PeerHighlightPass.md)), not something this transport-only class reconciles.
- A peer hovering an object no local id resolves to is still recorded in `registry`, same as `PeerSelectionSync`'s equivalent case - every renderer reading `registry` skips drawing anything for an id `SelectionManager.targetFor` can't resolve.
