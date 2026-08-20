<h1 align="center">
  network
</h1>

<p align="center">
  Networking primitives for JollyPixel's collaborative editors
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/network
```

## 👀 Usage example

### Vite server

```ts
import * as network from "@jolly-pixel/network";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

export default {
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new network.PresenceOnlyExtension("echo", "echo", {
          broadcast: true
        })
      ]
    })
  ]
};
```

### Browser client

```ts
import * as network from "@jolly-pixel/network/client";

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
- [Server](./docs/Server.md): room multiplexer
- [Extension](./docs/Extension.md): room-side base class, including worker-mode extensions
- [Rights](./docs/Rights.md): role-based access control
- [Transports](./docs/Transports.md): Vite plugin and websocket wiring
- [SyncAdapter](./docs/sync/SyncAdapter.md): client-side sync sessions
- [Conflicts](./docs/sync/Conflicts.md): server-side conflict resolution

[ARCHITECTURE.md](./ARCHITECTURE.md) covers the wire format and connection lifecycle.

## ✨ Contributors guide

Read the [contributing guide][contributing] before submitting a change.

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
