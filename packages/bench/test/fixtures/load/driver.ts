// Import Node.js Dependencies
import { setTimeout as sleep } from "node:timers/promises";
import { workerData } from "node:worker_threads";

// Import Internal Dependencies
import {
  LoadMeter,
  runLoadDriver,
  type LoadDriverInit
} from "../../../src/index.ts";

export interface FixtureWorkload {
  roundTripMs: number;
}

const init: LoadDriverInit<FixtureWorkload> = workerData;
const meter = new LoadMeter();

await runLoadDriver(init, {
  meter,
  connect: (index) => index,
  act: () => {
    meter.sent++;
    if (init.workload.roundTripMs === 0) {
      return;
    }

    return sleep(init.workload.roundTripMs);
  },
  close: () => void 0
});
