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
}
```

`new Client(options?)` enables reconnect by default.

### ready

Whether the socket is open. Room admission is confirmed separately by `sync`.

### `room(name, options?): Room`

Returns a handle without joining. Repeated names reuse it; only the first options
apply. The optional `parser` validates incoming payloads.

### `destroy(): void`

Closes the socket and cancels retries.

### Reconnecting

Joined rooms lose their client id and peers, then rejoin on reconnect.
Authentication refusal emits `unauthorized` and stops retries.

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

### Events

#### message / sync

Feature payloads / admission confirmation.

#### peer-joined / peer-left / peer-presence

Peer changes; the peer map is already updated.

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

### `publish(value): boolean` / `values`

`publish` skips unchanged values. `values` contains remote peers.

### change

Emits `{ clientId, value }`; `undefined` means removal.

### `destroy(): void`

Detaches the channel without leaving the room.
