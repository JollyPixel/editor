# Client

`Client`
connects to a server and manages room handles and peer presence.

```ts
import { Client } from "@jolly-pixel/network/client";

const client = new Client();
const room = client.room("lobby");
room.on("sync", () => console.log(room.peers));
room.join();
```

## Client

### Constructor

```ts
interface ClientOptions {
  profile?: PeerMetadata;
  logger?: Logger;
  socket?: () => ClientSocket;
  reconnect?: boolean | ClientReconnectOptions;
  trustServer?: boolean;
}
```

`new Client(options?)` enables reconnect by default.

- `trustServer`, off by default, parses server messages with plain
  `JSON.parse` and checks only their `room` and `kind`. Prototype keys such as
  `__proto__` are kept, and the envelope schema is skipped. Enable it only for
  a server you operate. A room's `parser` still validates its payloads.

### ready

Whether the socket is open. Room admission is confirmed separately by `sync`.

### `room(name, options?): Room`

Returns a handle without joining. Repeated names reuse it; only the first options
apply. The optional `parser` validates incoming payloads.

### `reconnect(): void`

Opens a new socket after an authentication refusal, for example once the user
has signed in again. Does nothing in any other state, including after
`destroy()`.

### `destroy(): void`

Closes the socket and cancels retries.

### Reconnecting

Joined rooms lose their client id and peers, then rejoin on reconnect.
Authentication refusal emits `unauthorized` and stops retries until
`reconnect()`. Messages sent while refused are dropped; joined rooms rejoin
with their presence and resume payload, so `CommandSync` resends its pending
changes.

## Room

### `join(): void` / `leave(): void`

Enter or retire the handle. After leaving, obtain a new one from `client.room()`.

### `send(payload): void`

Sends feature activity, subject to server validation and rights.

### `updatePresence(patch): void`

Shallow-merges presence. Use `null` to clear a field.

### `resync(): void` / `resumeWith(source): void`

Request fresh state or supply reconnect data.

### `peers` / `can(event): Right`

`peers` contains remote members only. `can(event)` resolves access for UI controls.

### `profile`

This client's profile as the server admitted it, with the server's fields over the
claimed ones. Before the first `sync` and after `leave()`, it is the claimed
profile. Read it with
[`parsePeerProfile`](../protocol/PeerProfile.md).

### Events

#### message / sync

Feature payloads / admission confirmation.

#### peer-joined / peer-left / peer-presence

Peer changes; the peer map is already updated.

#### peer-profile

`{ clientId, patch }`: the server changed a member's profile. When `clientId` is
`room.clientId`, `profile` holds the change; otherwise `peers` does.

#### denied / error / malformed

Permission refusal, operation failure, or parser rejection.

#### left

Local cleanup. Subscribe with `on`; remove listeners with `off`.

## PresenceChannel API

### Constructor

```ts
interface PresenceChannelOptions<T> {
  key: string;
  decode: PresenceDecoder<T>;
  equals?: (left: T, right: T) => boolean;
}
```

`new PresenceChannel(room, options)` tracks one typed field.

### `publish(value): boolean` / `published` / `values`

`publish` skips unchanged values. `published` is the last value this client
published, `undefined` before the first `publish`. `values` contains remote peers.

### change

Emits `{ clientId, value }`; `undefined` means removal.

### `destroy(): void`

Detaches the channel without leaving the room.

## RoomGrants API

### CapabilityTable

```ts
const table = new CapabilityTable({
  stroke: "pixels",
  fill: "pixels",
  "palette-changed": "palette"
});
```

Groups room events into capabilities. `resolveGrants(source)` grants a capability
only when `source.can()` returns `"write"` for every event mapped to it.
`full` and `none` grant every capability and none. `governs(event)` tells
whether the table maps an event.

### Grants

`has(capability)` tells whether a capability is granted. `readOnly` is `true`
when nothing is. `equals(other)` compares two grants. Instances are frozen.

### Constructor

`new RoomGrants(room, table)` follows one room. `current` is `table.full` until
the room admits this client, then follows each `sync`.

### change / denied

`change` emits the new grants when a `sync` changes them. `denied` emits the
event name of a refusal the table governs.

### `dispose(): void`

Stops following the room.
