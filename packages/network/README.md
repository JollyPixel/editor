<h1 align="center">
  network
</h1>

<p align="center">
  The shared wire for JollyPixel's multiplayer editors
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/network
# or
$ yarn add @jolly-pixel/network
```

## 👀 Usage example

Using vite

```ts
import * as network from "@jolly-pixel/network";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

class EchoAuthority extends network.RoomAuthority {
  readonly id = "echo";
  readonly name = "echo";

  onClientConnect(client: network.ClientHandle) {}
  onClientDisconnect(clientId: string) {}
  onMessage(clientId: string, payload: unknown, room: network.RoomHandle) {
    // payload is whatever the client's room.send() sent, envelope-free
    room.broadcast(payload);
  }
}

export default {
  plugins: [
    createWebSocketNetworkPlugin({
      roomAuthorities: [
        new EchoAuthority()
      ]
    })
  ]
};
```

Browser:

```ts
import * as network from "@jolly-pixel/network";

const client = new network.Client();
const room = client.room("echo");

room.on("message", (payload) => console.log(payload));
room.on("peer-joined", (event) => console.log(`${event.clientId} joined`));
room.on("peer-left", (event) => console.log(`${event.clientId} left`));
room.join();
room.send({ hello: "world" });
```

## 📚 API

- [`Client`](./docs/Client.md)
  - [`Room`](./docs/Room.md): room-scoped handles
  - [`SyncAdapter`](./docs/sync/SyncAdapter.md): base class for a client-side sync session (stamping, echo-guarding, snapshot/ready bookkeeping)
- [`Server`](./docs/Server.md): transport-agnostic room multiplexer
  - [`RoomAuthority`](./docs/RoomAuthority.md): per-room server logic — declares its type `name` and event vocabulary, never its own roles/rights
  - [`RightsTable`](./docs/RightsTable.md): per-role `read`/`write`/`void` lookup, glob-matched against `${authority.name}.${event}`, configured once via `new Server({ rights })`
  - [`ConflictResolver` / `LastWriteWinsResolver`](./docs/sync/ConflictResolver.md): server-side last-write-wins conflict resolution
  - [`ConflictTracker`](./docs/sync/ConflictTracker.md): per-key last-accepted-command bookkeeping around a `ConflictResolver`

### 🚋 Transports

- [`WebsocketTransport`](./docs/transport/websocket.md): ws-server plumbing into a `Server`

> [!TIP]
> As an end user or editor creator you should not worry too much about that

### 📦 Plugins

- [`createWebSocketNetworkPlugin`](./docs/plugins/vite.md): Vite dev-server wiring

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
