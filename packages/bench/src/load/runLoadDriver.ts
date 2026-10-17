// Import Node.js Dependencies
import {
  performance,
  type EventLoopUtilization
} from "node:perf_hooks";
import { parentPort } from "node:worker_threads";

// Import Internal Dependencies
import type { LoadMeter } from "./LoadMeter.ts";
import type {
  DriverCommand,
  DriverEvent,
  LoadDriverInit
} from "./protocol.ts";
import {
  RateSchedule,
  type PacedEntry
} from "./RateSchedule.ts";

export interface LoadDriverOptions<TEntry extends PacedEntry> {
  meter: LoadMeter;
  entries: readonly TEntry[];
  act: (entry: TEntry) => void;
  close: () => void;
}

export function runLoadDriver<TEntry extends PacedEntry>(
  init: LoadDriverInit<unknown>,
  options: LoadDriverOptions<TEntry>
): void {
  const { meter, entries, act, close } = options;
  const schedule = new RateSchedule({
    rate: init.rate,
    entries,
    act
  });
  const offsets = RateSchedule.staggered(
    init.clientIndices,
    init.totalClients,
    init.rate
  );
  let elu: EventLoopUtilization = performance.eventLoopUtilization();

  parentPort?.on("message", (command: DriverCommand) => {
    switch (command.type) {
      case "run":
        schedule.start(offsets);
        break;
      case "pause":
        schedule.stop();
        break;
      case "reset":
        meter.reset();
        schedule.missed = 0;
        elu = performance.eventLoopUtilization();
        break;
      case "report":
        post({
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
        });
        break;
      default:
        close();
        parentPort?.close();
    }
  });
  post({ type: "ready" });
}

function post(
  event: DriverEvent
): void {
  parentPort?.postMessage(event);
}
