# Load

A load harness (`bench:load` in network and asset-server) starts a server in a
child process and drives it from worker threads. It is three files: the entry
runs a `LoadHarness`, the server module calls `runLoadServer()`, and the driver
module connects its clients and calls `runLoadDriver()`.

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
    scenario: Flag.choice(SCENARIOS, "presence", "scenario"),
    rooms: Flag.positive(5, "rooms the clients spread over")
  },
  server: new URL("./server.ts", import.meta.url),
  driver: new URL("./driver.ts", import.meta.url),
  plan: (values) => ({
    serverConfig: { rooms: values.rooms },
    workload: { scenario: values.scenario },
    columns: { scenario: values.scenario, clients: values.clients }
  })
});

await harness.run();
```

## LoadHarness

```ts
interface LoadHarnessOptions<TValues, TServerConfig, TWorkload> {
  name: string; // report title
  summary: string;
  flags: FlagDefinitions<TValues>;
  server: URL;
  driver: URL;
  plan(values: SharedLoadValues & TValues): LoadPlan<TServerConfig, TWorkload>;
}

interface LoadPlan<TServerConfig, TWorkload> {
  serverConfig: TServerConfig; // read by loadServerConfig()
  workload: TWorkload; // LoadDriverInit#workload
  columns: LoadColumns; // printed before the measured columns
}

interface SharedLoadValues {
  clients: number; // --clients, default 50
  rate: number; // --rate, actions per client per second, default 30
  duration: number; // --duration, measured seconds, default 10
  warmup: number; // --warmup, seconds before them, default 2
  workers: number; // --workers, default available cores - 2, between 1 and 4
  compression: boolean; // --compression, permessage-deflate
  profile: string | undefined; // --profile <dir>, server --cpu-prof
  json: boolean; // --json
}
```

### `run(argv = process.argv.slice(2)): Promise<BenchmarkReport | null>`

Forks the server and the drivers, runs the warmup then the measured window,
and prints one row: the plan's `columns`, then the measured ones. Returns
`null` for `--help`.

- An unknown or rejected flag, or a `BenchmarkError` thrown by `plan`, prints
  its message and sets the exit code to 1 before anything starts.
- `--help` prints the usage even when other flags are invalid.
- It warns when a driver worker is saturated, since the latencies then include
  the worker's own queueing.

### `usage(): string`

Builds one line per flag, default included, from the flag definitions.

## Flag

```ts
class Flag<TValue> {
  static positive(fallback: number, description: string, placeholder?: string): Flag<number>;
  static nonNegative(fallback: number, description: string, placeholder?: string): Flag<number>;
  static choice<TChoice extends string>(
    choices: readonly TChoice[],
    fallback: TChoice,
    description: string
  ): Flag<TChoice>;
  static toggle(description: string): Flag<boolean>;
  static text(placeholder: string, description: string): Flag<string | undefined>;
  static list(placeholder: string, description: string): Flag<string[]>;
}

type FlagDefinitions<TValues> = {
  readonly [TName in keyof TValues]: Flag<TValues[TName]>;
};
```

The key of a definition is the flag name: `rooms` is `--rooms`. `list` flags
can repeat.

## Driver

```ts
// Import Node.js Dependencies
import { workerData } from "node:worker_threads";

// Import Third-party Dependencies
import {
  LoadMeter,
  runLoadDriver,
  type LoadDriverInit
} from "@jolly-pixel/bench";

const init: LoadDriverInit<Workload> = workerData;
const url = `ws://127.0.0.1:${init.port}${DEFAULT_WEBSOCKET_PATH}`;
const meter = new LoadMeter();

await runLoadDriver(init, {
  meter,
  async connect(index) {
    const client = await LoadClient.connect(url, meter);
    await client.join(roomName(index % init.workload.rooms));

    return client;
  },
  act: (client) => client.send(presenceEnvelope()),
  close: (client) => client.close()
});
```

### `runLoadDriver(init, options): Promise<void>`

```ts
interface LoadDriverInit<TWorkload> {
  port: number; // the server's
  rate: number;
  workload: TWorkload;
  clientIndices: number[];
  totalClients: number;
}

interface LoadDriverOptions<TEntry> {
  meter: LoadMeter;
  connect(index: number): TEntry | Promise<TEntry>;
  act(entry: TEntry): void | Promise<unknown>;
  close(entry: TEntry): void;
}
```

- Calls `connect` for each client index of the worker, then paces each entry
  at `--rate` actions per second.
- When `act` returns a promise, the entry skips its turns until it settles,
  and the duration is recorded as own latency.
- On close, calls `close` once per entry.
- Throws a `BenchmarkError` outside a worker thread.

### LoadMeter

```ts
class LoadMeter {
  readonly own: RecordableHistogram;
  readonly peer: RecordableHistogram;
  sent: number;
  received: number;
  bytes: number;
  record(origin: "own" | "peer", startedAtMs: number, endedAtMs: number): void;
}
```

`record()` stores a duration in microseconds. Clients call it for latencies
they time themselves, such as a broadcast echoed back with its send time.

## Server

```ts
// Import Node.js Dependencies
import http from "node:http";

// Import Third-party Dependencies
import {
  loadServerConfig,
  runLoadServer
} from "@jolly-pixel/bench";

const config = loadServerConfig<LoadServerConfig>();
const server = new Server({ logger: silentLogger() });
const httpServer = http.createServer();
const transport = new WebsocketTransport({
  httpServer,
  server,
  compression: config.compression
});

runLoadServer(httpServer, async() => {
  transport[Symbol.dispose]();
  httpServer.close();
  await server.close();
});
```

### `loadServerConfig<TServerConfig>(): TServerConfig`

Returns the plan's `serverConfig`.

### `runLoadServer(httpServer, close): void`

Listens on a free port of `127.0.0.1`, answers the CPU, event loop, heap and
GC samples, and calls `close` when the harness disconnects.
