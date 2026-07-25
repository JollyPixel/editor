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

Import the package as a namespace  `network.Client`, `network.Server`, `network.RoomAuthority`, etc.  rather than pulling individual named exports. It reads clearly at the call site and keeps growing without more import churn.

Server (Vite dev server):

```ts
import * as network from "@jolly-pixel/network";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

class EchoAuthority extends network.RoomAuthority {
  readonly id = "echo";

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

room.onMessage = (payload) => console.log(payload);
room.onPeerJoined = (clientId) => console.log(`${clientId} joined`);
room.onPeerLeft = (clientId) => console.log(`${clientId} left`);
room.send({ hello: "world" });
```

## 📚 API

- [`Client`](./docs/Client.md) / [`Room`](./docs/Room.md): browser/Node WebSocket client, room-scoped handles
- [`Server`](./docs/Server.md): transport-agnostic room multiplexer
- [`WebsocketTransport`](./docs/transport/websocket.md): ws-server plumbing into a `Server`
- [`createWebSocketNetworkPlugin`](./docs/plugins/vite.md): Vite dev-server wiring

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the wire format and full connection lifecycle.

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
