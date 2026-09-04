# PeerSelectionSync

`PeerSelectionSync` publishes the local
[`SelectionManager`](../SelectionManager.md)'s selected id to a room's
presence and applies every remote peer's published id into a
[`PeerSelectionRegistry`](../PeerSelectionRegistry.md).

## Import

```ts
import {
  PeerSelectionSync,
  type PeerSelectionSyncOptions
} from "@jolly-pixel/three/network";
```

This entry point requires the optional `@jolly-pixel/network` peer dependency.

## Setup

```ts
import * as network from "@jolly-pixel/network/client";
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays
} from "@jolly-pixel/three";
import { PeerSelectionSync } from "@jolly-pixel/three/network";

const client = new network.Client({
  identity: {
    username
  }
});
const room = client.room("my-room");
room.join();

const selection = new SelectionManager();
const registry = new PeerSelectionRegistry();
const overlays = new PeerSelectionOverlays({ registry, selection });

const sync = new PeerSelectionSync({
  room,
  registry,
  selection
});

selection.select("box-1"); // published to the room automatically
```

Call `destroy()` when the room or scene is torn down.

Everything downstream of `registry` -
[`PeerSelectionOverlays`](../PeerSelectionOverlays.md),
[`PeerHighlightPass`](../PeerHighlightPass.md),
[`PeerSelectionChips`](../PeerSelectionChips.md),
[`PeerSelectionVisibility`](../PeerSelectionVisibility.md) - is already
transport-agnostic and needs no changes to render real peer selections; this
class is only the network glue feeding `registry` from `room` instead of a
caller's own script.

## Constructor

```ts
new PeerSelectionSync(options: PeerSelectionSyncOptions)
```

The constructor subscribes to room events, applies every peer already known
to `room.peers`, and publishes the local selection's current value (`null` if
nothing is selected yet).

```ts
interface PeerSelectionSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  presenceKey?: string;
  resyncIntervalMs?: number;
}
```

| Option | Default | Description |
|---|---|---|
| `room` | required | Room used to publish and receive selections. |
| `registry` | required | Remote peer selections read from the room are applied here. |
| `selection` | required | Local selection state published to the room. |
| `presenceKey` | `"selection"` | Presence field used for selections. Set a different key for each selection stream in the same room. |
| `resyncIntervalMs` | `5000` | How often every currently connected peer's presence is re-applied from `room.peers` - a safety net against a single dropped/out-of-order `peer-presence` message leaving `registry` stuck on stale state forever (the transport has no per-message ack/retry, and this class is otherwise purely event-driven). Cheap when nothing drifted - `PeerSelectionRegistry.select` no-ops without dispatching when the id is already current. Set to `0` to disable. |

Unlike [`PeerFrustumSync`](./PeerFrustumSync.md), there is no
`attach()`/`update()` split and nothing to call once per render tick: a
`SelectionManager`'s `selectionChange` event already fires exactly when the
local selection changes, so publishing from that listener is both necessary
and sufficient. Camera pose needs continuous polling because motion isn't an
event; a click-driven selection already is one.

Also unlike `PeerFrustumSync`, no local-identity stamping is needed to agree
on a peer's own color: `PeerSelectionRegistry.colorOf` is a pure, peer-only
function of the id `select()` is called with, and the local user's own
selection is never entered into `registry` at all (it stays in
`selection.color`/`selection.hoverColor`, rendered separately by
`SelectionManager` itself) - so the room's own server-assigned `clientId` is
sufficient as the registry's peer id, and every peer resolves the same peer
to the same color without coordinating.

## Methods

### `destroy()`

```ts
destroy(): void
```

Unsubscribes from `room` and `selection`, stops the periodic resync (see
`resyncIntervalMs` above), and removes every peer this instance applied to
`registry` - so tearing this down does not leave a stale peer selection
behind in a `registry` that outlives it. Does not touch `registry`/`selection`
otherwise, and does not call `room.leave()`.

## Presence value

Selections are stored under `presenceKey` as a plain string or `null`:

```ts
type PeerSelectionId = string | null;
```

`null` means "this peer has nothing selected" - a known, valid state, unlike
a missing or malformed value, which is ignored and leaves the peer's last
known selection alone rather than clearing it. Use
[`decodePeerSelectionId`](index.md#selection-helpers) when reading the same
presence field elsewhere.

## Notes

- Every peer must register the same id for the same object under
  `SelectionManager`/its own local registry for a remote selection to
  resolve to anything visible - this class only carries the id string across
  the network, it does not reconcile scene graphs. A fixed, shared scene
  (same ids on every client) is the simplest way to guarantee that; a
  dynamically built scene needs its own stable, content-addressed id scheme.
- Hover is synced separately, by [`PeerHoverSync`](./PeerHoverSync.md) into
  its own [`PeerHoverRegistry`](../PeerHoverRegistry.md) - not this class.
  Selection changes are click-driven (low frequency) and published as-is
  here; hover is enter/exit-driven but can still burst on a fast sweep across
  many objects, so `PeerHoverSync` throttles with a trailing flush instead of
  publishing every change directly - see its own doc comment.
- A peer selecting an object no local id resolves to (e.g. it was never
  registered on this client) is still recorded in `registry` - `selectorsOf`
  reports it like any other selector - but every renderer reading `registry`
  (`PeerSelectionOverlays`, `PeerHighlightPass`, `PeerSelectionChips`) skips
  drawing anything for an id `SelectionManager.targetFor` can't resolve.
- `resyncIntervalMs`'s periodic reconciliation only ever *heals* drift
  against `room.peers`' own current state - it cannot recover a peer the
  transport itself never told this client left (`room.peers` wouldn't have
  it either in that case). It bounds "stuck on stale state until a page
  refresh" to at most one interval, not "never".
