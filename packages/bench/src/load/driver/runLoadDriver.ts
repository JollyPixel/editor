// Import Node.js Dependencies
import {
  performance,
  type EventLoopUtilization
} from "node:perf_hooks";
import { parentPort } from "node:worker_threads";

// Import Internal Dependencies
import { BenchmarkError } from "../../errors/index.ts";
import type {
  DriverCommand,
  DriverEvent,
  LoadDriverInit
} from "../protocol.ts";
import type { LoadMeter } from "./LoadMeter.ts";
import {
  RateSchedule,
  type PacedAction
} from "./RateSchedule.ts";

export interface LoadDriverOptions<TEntry> {
  meter: LoadMeter;
  /**
   * Called once per client index this worker drives, before the run starts.
   */
  connect: (index: number) => TEntry | Promise<TEntry>;
  /**
   * A returned promise is a round trip: the entry skips its turns until it
   * settles, and its duration is recorded as own latency.
   */
  act: PacedAction<TEntry>;
  close: (entry: TEntry) => void;
}

export async function runLoadDriver<TEntry>(
  init: LoadDriverInit<unknown>,
  options: LoadDriverOptions<TEntry>
): Promise<void> {
  const port = parentPort;
  if (port === null) {
    throw new BenchmarkError("runLoadDriver() must run in a worker thread");
  }

  const { meter, connect, act, close } = options;
  const entries = await Promise.all(
    init.clientIndices.map(async(index) => {
      return {
        index,
        entry: await connect(index)
      };
    })
  );
  const schedule = new RateSchedule({
    rate: init.rate,
    entries,
    total: init.totalClients,
    act,
    onRoundTrip: (startedAtMs, endedAtMs) => {
      meter.record("own", startedAtMs, endedAtMs);
    }
  });
  let elu: EventLoopUtilization = performance.eventLoopUtilization();

  port.on("message", (command: DriverCommand) => {
    switch (command.type) {
      case "run":
        schedule.start();
        break;
      case "pause":
        schedule.stop();
        break;
      case "reset":
        meter.reset();
        schedule.resetMissed();
        elu = performance.eventLoopUtilization();
        break;
      case "report":
        port.postMessage({
          type: "report",
          report: {
            own: meter.own,
            peer: meter.peer,
            sent: meter.sent,
            received: meter.received,
            bytes: meter.bytes,
            missed: schedule.missed,
            elu: performance.eventLoopUtilization(elu).utilization
          }
        } satisfies DriverEvent);
        break;
      default:
        schedule.stop();
        for (const { entry } of entries) {
          close(entry);
        }
        port.close();
    }
  });
  port.postMessage({ type: "ready" } satisfies DriverEvent);
}
