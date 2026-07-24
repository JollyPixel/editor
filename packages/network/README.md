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

Server (Vite dev server):

```ts
import {
  NetworkPlugin,
  type ClientHandle
} from "@jolly-pixel/network";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

class EchoPlugin extends NetworkPlugin {
  readonly namespace = "echo";

  onClientConnect(client: ClientHandle) {}
  onClientDisconnect(clientId: string) {}
  onMessage(clientId: string, payload: unknown) {
    // payload is whatever the client's channel.send() sent, envelope-free
  }
}

export default {
  plugins: [
    createWebSocketNetworkPlugin({
      plugins: [
        new EchoPlugin()
      ]
    })
  ]
};
```

Browser:

```ts
import {
  NetworkClient
} from "@jolly-pixel/network";

const client = new NetworkClient({
  url: "ws://localhost:5173/ws-sync
});
const channel = client.channel("echo");

channel.onMessage = (payload) => console.log(payload);
channel.onPeerJoined = (clientId) => console.log(`${clientId} joined`);
channel.onPeerLeft = (clientId) => console.log(`${clientId} left`);
channel.send({ hello: "world" });
```

## 📚 API

- [`NetworkClient`](./docs/NetworkClient.md) / [`NetworkChannel`](./docs/NetworkChannel.md): browser/Node WebSocket client, namespace-scoped channels
- [`NetworkServer`](./docs/NetworkServer.md) / [`NetworkPlugin`](./docs/NetworkPlugin.md): transport-agnostic namespace multiplexer and per-namespace plugin base class
- [`WebsocketTransport`](./docs/transport/websocket.md): ws-server plumbing into a `NetworkServer`
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
