// Import Node.js Dependencies
import { mkdirSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  STUDIO_ROOT,
  StudioProject
} from "../server/project/StudioProject.ts";
import { StudioServer } from "../server/StudioServer.ts";

// CONSTANTS
const kSamplingIntervalUs = 200;

const { values: args } = parseArgs({
  options: {
    seconds: { type: "string", default: "120" },
    out: { type: "string", default: "perf-results/server.cpuprofile" },
    heap: { type: "boolean", default: false }
  }
});

const project = await StudioProject.open(
  StudioProject.resolveRoot(STUDIO_ROOT),
  { inMemory: true }
);
const server = await StudioServer.open({
  project,
  shell: path.join(STUDIO_ROOT, "dist"),
  backend: {
    inMemory: true,
    requestsPerMinute: 100_000,
    accounts: {
      inMemory: true,
      defaultRole: "member",
      throttle: {
        registrations: 1_000
      }
    }
  }
});
const url = await server.listen(PORTS.studio, "localhost");

const inspector = new Session();
inspector.connect();
await inspector.post("Profiler.enable");
await inspector.post("Profiler.setSamplingInterval", {
  interval: kSamplingIntervalUs
});
await inspector.post("Profiler.start");
if (args.heap) {
  await inspector.post("HeapProfiler.enable");
  await inspector.post("HeapProfiler.startSampling", {
    samplingInterval: 16 * 1024,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true
  });
}
console.info(`Profiling ${url} for ${args.seconds} s`);

await setTimeout(Number(args.seconds) * 1000);

const { profile } = await inspector.post("Profiler.stop");
mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
writeFileSync(args.out, JSON.stringify(profile));
console.info(args.out);
if (args.heap) {
  const { profile: heapProfile } = await inspector.post("HeapProfiler.stopSampling");
  const heapFile = args.out.replace(/\.cpuprofile$/, "") + ".heapprofile";
  writeFileSync(heapFile, JSON.stringify(heapProfile));
  console.info(heapFile);
}
inspector.disconnect();
await server[Symbol.asyncDispose]();
