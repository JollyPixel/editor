// Import Node.js Dependencies
import {
  fork,
  type ChildProcess
} from "node:child_process";
import { once } from "node:events";
import { availableParallelism } from "node:os";
import {
  createHistogram,
  performance,
  type RecordableHistogram
} from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";

// Import Third-party Dependencies
import { runtimeMetadata } from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  SCENARIOS,
  type DriverCommand,
  type DriverEvent,
  type DriverInit,
  type DriverReport,
  type LoadServerConfig,
  type Scenario,
  type ServerCommand,
  type ServerEvent,
  type ServerSample
} from "./protocol.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../../src/index.ts";

// CONSTANTS
const kDrainMs = 250;
const kSaturatedElu = 0.8;
const kBytesPerMb = 1024 * 1024;
const kDefaultWorkers = Math.max(1, Math.min(4, availableParallelism() - 2));
const kUsage = `Usage: pnpm bench:load [options]

Starts a network server in a child process and drives it with WebSocket
clients spread over worker threads.

Options:
  --scenario <name>        presence, command or churn (default presence)
  --clients <n>            connected clients (default 50)
  --rooms <n>              rooms the clients spread over (default 5)
  --rate <hz>              actions per client per second (default 30)
  --duration <s>           measured seconds (default 10)
  --warmup <s>             unmeasured seconds before it (default 2)
  --workers <n>            driver worker threads (default ${kDefaultWorkers})
  --variants <n>           command variants in the protocol (default 20)
  --snapshot-bytes <n>     snapshot size sent on join (default 65536)
  --compression            negotiate permessage-deflate
  --rights                 gate every event through a rights table
  --profile <dir>          write a server --cpu-prof into this directory
  --json                   print one JSON object instead of a table
  --help                   print this message`;

interface LoadOptions extends LoadServerConfig {
  scenario: Scenario;
  clients: number;
  rate: number;
  durationMs: number;
  warmupMs: number;
  workers: number;
  profile: string | undefined;
  json: boolean;
}

interface EventSource<TEvent> {
  on(event: "message", listener: (event: TEvent) => void): unknown;
  off(event: "message", listener: (event: TEvent) => void): unknown;
  once(event: "exit", listener: () => void): unknown;
  off(event: "exit", listener: () => void): unknown;
}

const options = readOptions();
const server = startServer(options);
const { port } = await nextEvent<ServerEvent, "listening">(server, "listening");
const drivers = await startDrivers(
  options,
  `ws://127.0.0.1:${port}${DEFAULT_WEBSOCKET_PATH}`
);

broadcast(drivers, { type: "run" });
await sleep(options.warmupMs);
broadcast(drivers, { type: "reset" });
server.send({ type: "mark" } satisfies ServerCommand);
const startedAt = performance.now();
await sleep(options.durationMs);
broadcast(drivers, { type: "pause" });
const elapsedMs = performance.now() - startedAt;
const reports = await Promise.all(drivers.map(collectReport));
server.send({ type: "sample" } satisfies ServerCommand);
const { sample } = await nextEvent<ServerEvent, "sample">(server, "sample");

printResult(options, elapsedMs, sample, reports);

await sleep(kDrainMs);
broadcast(drivers, { type: "close" });
await Promise.all(drivers.map((driver) => once(driver, "exit")));
server.disconnect();
await once(server, "exit");

function readOptions(): LoadOptions {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string", default: "presence" },
      clients: { type: "string", default: "50" },
      rooms: { type: "string", default: "5" },
      rate: { type: "string", default: "30" },
      duration: { type: "string", default: "10" },
      warmup: { type: "string", default: "2" },
      workers: { type: "string", default: String(kDefaultWorkers) },
      variants: { type: "string", default: "20" },
      "snapshot-bytes": { type: "string", default: "65536" },
      compression: { type: "boolean", default: false },
      rights: { type: "boolean", default: false },
      profile: { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });
  if (values.help) {
    console.log(kUsage);
    process.exit(0);
  }

  const scenario = SCENARIOS.find((name) => name === values.scenario);
  if (scenario === undefined) {
    throw new Error(`--scenario expects one of ${SCENARIOS.join(", ")}`);
  }
  const clients = positive("clients", values.clients);

  return {
    scenario,
    clients,
    rooms: positive("rooms", values.rooms),
    rate: positive("rate", values.rate),
    durationMs: positive("duration", values.duration) * 1_000,
    warmupMs: positive("warmup", values.warmup) * 1_000,
    workers: Math.min(clients, positive("workers", values.workers)),
    variants: positive("variants", values.variants),
    snapshotBytes: positive("snapshot-bytes", values["snapshot-bytes"]),
    compression: values.compression,
    rights: values.rights,
    profile: values.profile,
    json: values.json
  };
}

function positive(
  name: string,
  raw: string
): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} expects a positive number, got "${raw}"`);
  }

  return value;
}

function startServer(
  options: LoadOptions
): ChildProcess {
  const config: LoadServerConfig = {
    rooms: options.rooms,
    variants: options.variants,
    snapshotBytes: options.snapshotBytes,
    compression: options.compression,
    rights: options.rights
  };
  const execArgv = options.profile === undefined ?
    [] :
    ["--cpu-prof", `--cpu-prof-dir=${options.profile}`];

  return fork(
    new URL("./server.ts", import.meta.url),
    [JSON.stringify(config)],
    { execArgv }
  );
}

async function startDrivers(
  options: LoadOptions,
  url: string
): Promise<Worker[]> {
  const drivers = Array.from({ length: options.workers }, (_, worker) => {
    const workerData: DriverInit = {
      url,
      workload: {
        scenario: options.scenario,
        rooms: options.rooms,
        rate: options.rate,
        variants: options.variants
      },
      clientIndices: Array.from(
        { length: options.clients },
        (_, index) => index
      ).filter((index) => index % options.workers === worker),
      totalClients: options.clients
    };

    return new Worker(new URL("./driver.ts", import.meta.url), {
      workerData
    });
  });
  await Promise.all(drivers.map(
    (driver) => nextEvent<DriverEvent, "ready">(driver, "ready")
  ));

  return drivers;
}

function broadcast(
  drivers: readonly Worker[],
  command: DriverCommand
): void {
  for (const driver of drivers) {
    driver.postMessage(command);
  }
}

async function collectReport(
  driver: Worker
): Promise<DriverReport> {
  driver.postMessage({ type: "report" } satisfies DriverCommand);
  const { report } = await nextEvent<DriverEvent, "report">(driver, "report");

  return report;
}

function nextEvent<
  TEvent extends { type: string; },
  TType extends TEvent["type"]
>(
  source: EventSource<TEvent>,
  type: TType
): Promise<Extract<TEvent, { type: TType; }>> {
  return new Promise((resolve, reject) => {
    function isExpected(
      event: TEvent
    ): event is Extract<TEvent, { type: TType; }> {
      return event.type === type;
    }
    function onMessage(
      event: TEvent
    ): void {
      if (isExpected(event)) {
        source.off("exit", onExit);
        source.off("message", onMessage);
        resolve(event);
      }
    }
    function onExit(): void {
      source.off("message", onMessage);
      reject(new Error(`exited before sending "${type}"`));
    }

    source.on("message", onMessage);
    source.once("exit", onExit);
  });
}

function printResult(
  options: LoadOptions,
  elapsedMs: number,
  sample: ServerSample,
  reports: readonly DriverReport[]
): void {
  const seconds = elapsedMs / 1_000;
  const own = createHistogram();
  const peer = createHistogram();
  let sent = 0;
  let received = 0;
  let bytes = 0;
  let missed = 0;
  let driverElu = 0;
  for (const report of reports) {
    own.add(report.own);
    peer.add(report.peer);
    sent += report.sent;
    received += report.received;
    bytes += report.bytes;
    missed += report.missed;
    driverElu = Math.max(driverElu, report.elu);
  }

  const result = {
    scenario: options.scenario,
    clients: options.clients,
    rooms: options.rooms,
    "rate (Hz)": options.rate,
    compression: options.compression,
    rights: options.rights,
    "sent/s": Math.round(sent / seconds),
    "received/s": Math.round(received / seconds),
    "MB/s in": round(bytes / kBytesPerMb / seconds),
    "own p50 (ms)": percentile(own, 50),
    "own p99 (ms)": percentile(own, 99),
    "peer p50 (ms)": percentile(peer, 50),
    "peer p99 (ms)": percentile(peer, 99),
    "server cpu %": round(sample.cpuMs / elapsedMs * 100),
    "server µs/sent": sent === 0 ? null : round(sample.cpuMs * 1_000 / sent),
    "server elu": round(sample.elu),
    "server loop p99 (ms)": round(sample.loopDelayP99Ms),
    "server heap (MB)": round(sample.heapUsedMb),
    "server rss (MB)": round(sample.rssMb),
    "server gc": sample.gcCount,
    "server gc pause (ms)": round(sample.gcPauseMs),
    "driver elu (max)": round(driverElu),
    "missed ticks": missed
  };

  if (options.json) {
    const { node, v8, platform, cpu } = runtimeMetadata();
    console.log(JSON.stringify({
      runtime: {
        node,
        v8,
        platform,
        cpu
      },
      result
    }));
  }
  else {
    console.table(result);
  }
  if (driverElu > kSaturatedElu) {
    console.warn(
      "A driver worker is saturated: latencies include its own queueing."
    );
  }
}

function percentile(
  histogram: RecordableHistogram,
  value: number
): number | null {
  return histogram.count === 0 ?
    null :
    round(histogram.percentile(value) / 1_000);
}

function round(
  value: number
): number {
  return Number(value.toFixed(3));
}
