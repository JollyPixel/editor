# PixelCursorSession

Broadcasts the local cursor position and renders remote peers' cursors on `PixelArtCanvas.peerCursors`.

No server authority needed: presence is relayed by `network.Room` itself (`updatePresence`/`onPeerPresence`), independent of `PixelSyncServer`. Reuse the same room a `PixelSyncSession` already has open — one connection, two concerns.

## Channel Shape

```ts
interface PixelPresenceChannel {
	readonly clientId: string;
	readonly peers: ReadonlyMap<string, PixelPeer>;
	updatePresence(patch: PixelPeerPresence): void;
	onPeerJoined: ((clientId: string) => void) | null;
	onPeerLeft: ((clientId: string) => void) | null;
	onPeerPresence: ((clientId: string, patch: PixelPeerPresence) => void) | null;
}

interface PixelPeer {
	readonly clientId: string;
	readonly identity: PixelPeerIdentity; // Record<string, unknown>
	readonly presence: PixelPeerPresence; // Record<string, unknown>
}
```

`network.Client.room()` from `@jolly-pixel/network` satisfies this shape directly — no adapter required, and it's the very same object `PixelSyncSession` uses for buffer sync.

## Use It Like This

```ts
import {
  PixelSyncSession,
  PixelCursorSession
} from "@jolly-pixel/pixel-draw.renderer";

const transport = client.room<PixelNetworkCommand, PixelServerMessage>("pixel-draw:main");

const syncSession = new PixelSyncSession({ transport });
syncSession.attach(canvas);

const cursorSession = new PixelCursorSession({ channel: transport });
cursorSession.attach(canvas);

// Later
cursorSession.destroy();
```

Pass an `identity: { username: "..." }` on `new network.Client({ url, identity })` to give each peer a display label — `PixelCursorSession` reads `identity.username` by default. Override with `getLabel` for a different identity shape:

```ts
new PixelCursorSession({
  channel: transport,
  getLabel: (identity) => identity.displayName as string | undefined
});
```

## What It Does

1. Watches `canvas.onCursorMove` and calls `channel.updatePresence({ cursor: pos })`, deduped against the last position sent.
2. On `onPeerPresence`/`onPeerJoined`, mirrors the peer's cursor onto `canvas.peerCursors` with a color hashed from their client id.
3. On `onPeerLeft`, removes that peer's marker.
4. Chains onto whatever `onPeerJoined`/`onPeerLeft`/`onPeerPresence` handlers the channel already had (e.g. your own connect/disconnect logging), instead of replacing them.

## Lifecycle

### `attach(canvas)`

- Attaches exactly one canvas.
- Throws if you call `attach` twice without `detach`.
- Seeds cursors for peers already on the channel that have already reported a position.

### `detach()`

- Stops local cursor broadcasts.
- Leaves remote peer markers in place; call `destroy()` to also stop reacting to them.

### `destroy()`

- Calls `detach()`.
- Restores the channel's previous `onPeerJoined`/`onPeerLeft`/`onPeerPresence` handlers.

## Known Limitation

A peer who joined (and hasn't moved since) before you attach won't show a cursor until they move — `"sync"` populates `channel.peers` directly without firing `onPeerJoined`, so there's nothing to seed from until their next presence update.

## Common Mistakes

1. Building a second `network.Client`/room for cursors instead of reusing the sync one.
2. Setting `channel.onPeerJoined` etc. *after* constructing `PixelCursorSession` — set your own handlers first, then construct the session so it chains onto them.
