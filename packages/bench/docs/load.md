# Load

A load harness (`bench:load` in network and asset-server) starts a server in a
child process and drives it from worker threads. It is three files: the entry
runs a `LoadHarness`, the server module calls `runLoadServer()`, and the driver
module connects its clients and calls `runLoadDriver()`. The network
workspace's `bench/load/` is the reference harness; the types in `src/load/`
cover the rest.

```ts
// Import Third-party Dependencies
import {
  Flag,
  LoadHarness
} from "@jolly-pixel/bench";

const harness = new LoadHarness({
  name: "network / load",
  summary: "Starts a network server in a child process.",
  flags: {
    rooms: Flag.positive(5, "rooms the clients spread over")
  },
  server: new URL("./server.ts", import.meta.url),
  driver: new URL("./driver.ts", import.meta.url),
  plan: (values) => ({
    serverConfig: { rooms: values.rooms },
    workload: { rooms: values.rooms },
    columns: { clients: values.clients, rooms: values.rooms }
  })
});

await harness.run();
```

`plan` turns the flag values into the server's `loadServerConfig()`, the
driver's `init.workload`, and the columns printed before the measured ones.
Throwing a `BenchmarkError` from it rejects the flag combination before
anything starts. A flag's key is its name, so `rooms` is `--rooms`.

Every harness also takes these flags:

- `--clients`: connected clients, 50 by default.
- `--rate`: actions per client per second, 30 by default.
- `--duration` and `--warmup`: measured seconds (10) and unmeasured seconds
  before them (2).
- `--workers`: driver threads, available cores minus 2 clamped to 1–4, never
  more than `--clients`.
- `--compression`: negotiate permessage-deflate.
- `--profile <dir>`: write a server `--cpu-prof` there.
- `--json`: print one JSON object instead of a table.

## Driver

- `runLoadDriver()` throws outside a worker thread.
- It calls `connect` once per client index of the worker, then paces each
  entry at `--rate`.
- When `act` returns a promise, the entry skips its turns until it settles and
  the duration is recorded as own latency.
- `LoadMeter.record()` stores microseconds. Clients call it for latencies they
  time themselves, such as a broadcast echoed back with its send time.
- The harness warns when a driver worker's event loop is more than 80% busy,
  since latencies then include the worker's own queueing.

## Server

`runLoadServer(httpServer, close)` listens on a free port of `127.0.0.1`,
answers the harness's CPU, event loop, heap and GC samples, and calls `close`
when the harness disconnects.
