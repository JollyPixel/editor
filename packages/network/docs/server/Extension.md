# Extension

`Extension`
implements a room's feature behavior and owns its state or persistence.

```ts
import {
  PresenceOnlyExtension,
  Server
} from "@jolly-pixel/network";

const server = new Server();
server.register(
  new PresenceOnlyExtension("lobby")
);
```

## Properties

```ts
readonly id: string;
readonly name: string;
readonly protocols: MessageProtocols;
```

`id` is the static room name; `name` is the feature namespace for rights rules.
`protocols` defines inbound/outbound [message contracts](../protocol/Messages.md).

## Hooks

Hooks are optional, support promises, and use `override` in subclasses.

### `onClientConnect(client, peer, context)`

Runs after admission. Send initial feature state here.

### `onClientDisconnect(clientId, context)`

Handles departure.

### `onMessage(clientId, message, context)`

Receives validated, permitted activity.

### `onResync(clientId, context)`

Replies with fresh state.

### `dispose()`

Releases resources on eviction or shutdown.

## Room context

`context.identity` is trusted; `peer.resume` requires feature validation.
`context.room.broadcast` / `sendTo` validate payloads and filter by read rights.

## Presence-only rooms

`PresenceOnlyExtension(id, name?, options?)` carries presence without messages.
The third argument `{ broadcast: true }` enables relay; rights require protocols.

## Worker extensions

`WorkerExtensionProxy` from `/node` runs an extension in a dedicated worker.
Supply its descriptor and `{ logger }`, then register it normally.

Worker data must be structured-cloneable. Await `server.close()` for cleanup.
