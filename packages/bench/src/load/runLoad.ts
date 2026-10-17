// Import Node.js Dependencies
import {
  fork,
  type ChildProcess
} from "node:child_process";
import { once } from "node:events";
import {
  createHistogram,
  performance,
  type RecordableHistogram
} from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { Worker } from "node:worker_threads";

// Import Internal Dependencies
import { nextEvent } from "./nextEvent.ts";
import type {
  DriverCommand,
  DriverEvent,
  DriverReport,
  LoadDriverInit,
  ServerCommand,
  ServerEvent
} from "./protocol.ts";
import type { ServerSample } from "./ServerProbe.ts";

// CONSTANTS
const kDrainMs = 250;

export interface LoadRunOptions<TServerConfig, TWorkload> {
  server: URL;
  serverConfig: TServerConfig;
  driver: URL;
  workload: TWorkload;
  clients: number;
  /**
   * Actions per client per second.
   */
  rate: number;
  workers: number;
  durationMs: number;
  warmupMs: number;
  /**
   * Directory receiving a server `--cpu-prof`.
   */
  profile?: string;
}

export interface LoadRun {
  elapsedMs: number;
  sample: ServerSample;
  own: RecordableHistogram;
  peer: RecordableHistogram;
  sent: number;
  received: number;
  bytes: number;
  missed: number;
  /**
   * Highest event loop utilization among the driver workers.
   */
  driverElu: number;
}

export async function runLoad<TServerConfig, TWorkload>(
  options: LoadRunOptions<TServerConfig, TWorkload>
): Promise<LoadRun> {
  const server = startServer(options);
  const { port } = await nextEvent<ServerEvent, "listening">(
    server,
    "listening"
  );
  const drivers = await startDrivers(options, port);

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

  await sleep(kDrainMs);
  broadcast(drivers, { type: "close" });
  await Promise.all(drivers.map((driver) => once(driver, "exit")));
  server.disconnect();
  await once(server, "exit");

  return {
    elapsedMs,
    sample,
    ...mergeReports(reports)
  };
}

function startServer(
  options: LoadRunOptions<unknown, unknown>
): ChildProcess {
  const execArgv = options.profile === undefined ?
    [] :
    ["--cpu-prof", `--cpu-prof-dir=${options.profile}`];

  return fork(
    options.server,
    [JSON.stringify(options.serverConfig)],
    { execArgv }
  );
}

async function startDrivers<TWorkload>(
  options: LoadRunOptions<unknown, TWorkload>,
  port: number
): Promise<Worker[]> {
  const { clients, workers } = options;
  const drivers = Array.from({ length: workers }, (_, worker) => {
    const workerData: LoadDriverInit<TWorkload> = {
      port,
      rate: options.rate,
      workload: options.workload,
      clientIndices: Array.from({ length: clients }, (_, index) => index)
        .filter((index) => index % workers === worker),
      totalClients: clients
    };

    return new Worker(options.driver, { workerData });
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

function mergeReports(
  reports: readonly DriverReport[]
): Omit<LoadRun, "elapsedMs" | "sample"> {
  const merged = {
    own: createHistogram(),
    peer: createHistogram(),
    sent: 0,
    received: 0,
    bytes: 0,
    missed: 0,
    driverElu: 0
  };
  for (const report of reports) {
    merged.own.add(report.own);
    merged.peer.add(report.peer);
    merged.sent += report.sent;
    merged.received += report.received;
    merged.bytes += report.bytes;
    merged.missed += report.missed;
    merged.driverElu = Math.max(merged.driverElu, report.elu);
  }

  return merged;
}
