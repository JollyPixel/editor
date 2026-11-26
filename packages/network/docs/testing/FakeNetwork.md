# FakeNetwork

In-memory rooms for unit tests of code that takes a `Room`, imported from
`@jolly-pixel/network/testing`. No server or socket is involved: presence moves
between rooms synchronously.

```ts
import { FakeNetwork } from "@jolly-pixel/network/testing";

const network = new FakeNetwork();
const alice = network.connect("alice");
const bob = network.connect("bob");

alice.updatePresence({ cursor: 4 });
bob.peers.get("alice")?.presence; // { cursor: 4 }
```

## `FakeNetwork`

### `connect(clientId: string): FakeRoom`

Returns a joined room for `clientId`. Rooms already connected get the new peer
and a `peer-joined` event; the new room lists them in `peers` without events.

### `disconnect(room: FakeRoom): void`

Removes the room and emits `peer-left` on every other room. `room.leave()`
calls it.

## `FakeRoom`

Implements `Room` with the `editor` role, and `can(event)` returns `write` for
every event. Its profile is
`{ username: clientId, peerId: clientId }`.

- `updatePresence(patch)` merges a JSON copy of `patch` into `presence`, then
  emits `peer-presence` on every other room with the same patch.
- `send(payload)` pushes `payload` to `sent` and delivers nothing.
- `join`, `resync` and `resumeWith` do nothing.
