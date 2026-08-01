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

class EchoExtension extends network.Extension {
  readonly id = "echo";
  readonly name = "echo";

  onClientConnect(client: network.ClientHandle) {}
  onClientDisconnect(clientId: string) {}
  onMessage(clientId: string, payload: unknown, context: network.RoomContext) {
    // payload is whatever the client's room.send() sent, envelope-free
    context.room.broadcast(payload);
  }
}

export default {
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new EchoExtension()
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

- [Client](./docs/Client.md): client connection and room handles
- [Server](./docs/Server.md): room multiplexer and the `Extension` base class
- [Rights](./docs/Rights.md): role-based access control
- [Transports](./docs/Transports.md): vite plugin and websocket wiring
- [SyncAdapter](./docs/sync/SyncAdapter.md): client-side sync sessions
- [Conflicts](./docs/sync/Conflicts.md): server-side conflict resolution

[ARCHITECTURE.md](./ARCHITECTURE.md) covers the wire format and connection lifecycle.

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
