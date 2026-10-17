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
} from "@jolly-pixel/network/node";

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

## API

- [Client](./docs/client/Client.md): rooms and presence
- [CommandSync](./docs/client/CommandSync.md): document synchronization
- [Server](./docs/server/Server.md): connections and room lifecycle
- [Extension](./docs/server/Extension.md): feature hooks and workers
- [Access](./docs/server/Access.md): authentication and rights
- [Messages](./docs/protocol/Messages.md): protocols and parsing
- [Peer profile](./docs/protocol/PeerProfile.md): profile fields and parsing
- [Transports](./docs/transport/Transports.md): hosting and socket adapters

Guides: [Getting started](./docs/guides/getting-started.md),
[Command synchronization](./docs/guides/command-sync.md).

## 📈 Benchmarks

```bash
$ pnpm --filter @jolly-pixel/network bench
$ pnpm --filter @jolly-pixel/network bench room --allocations
$ pnpm --filter @jolly-pixel/network bench:load --scenario command --clients 150
```

`bench` runs the micro suites in `bench/*.bench.ts` on the shared
`@jolly-pixel/bench` harness: envelope parsing, message protocol matching,
room fan-out with and without a rights table, `Server#receive`, and the client
receive path. `--allocations` adds a `B/op` column.

`bench:load` starts a server in a child process and drives it over real
WebSockets from worker threads. The `presence`, `command` and `churn`
scenarios report delivered messages per second, latency percentiles, and the
server's CPU, event loop utilization, heap and GC pauses. `--help` lists the
knobs. Treat a run as saturated when the server's event loop utilization nears
1 or the driver warns about its own; the latencies then include queueing.

## ✨ Contributors guide

Read the [contributing guide][contributing] before submitting a change.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
