// Import Node.js Dependencies
import { mkdirSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import {
  CPU_SAMPLING_INTERVAL_US,
  HEAP_SAMPLING
} from "@jolly-pixel/cdp";
import { PORTS } from "@jolly-pixel/e2e";
import { StudioServer } from "@jolly-pixel/server/node";

// Import Internal Dependencies
import {
  openStudioProject,
  STUDIO_SHELL_DIR,
  studioSeed
} from "../../node/studioFiles.ts";
import { SHELL_PREFERENCES } from "../../shared/preferences.ts";
import { E2E_BACKEND_OPTIONS } from "../../vite/e2eBackend.ts";

const { values: args } = parseArgs({
  options: {
    seconds: { type: "string", default: "120" },
    out: { type: "string", default: "perf-results/server.cpuprofile" },
    heap: { type: "boolean", default: false }
  }
});

const project = await openStudioProject({
  inMemory: true
});
const server = await StudioServer.open({
  project,
  shell: STUDIO_SHELL_DIR,
  backend: {
    inMemory: true,
    seed: await studioSeed(),
    preferences: SHELL_PREFERENCES,
    ...E2E_BACKEND_OPTIONS
  }
});
const url = await server.listen(PORTS.studio, "localhost");

const inspector = new Session();
inspector.connect();
await inspector.post("Profiler.enable");
await inspector.post("Profiler.setSamplingInterval", {
  interval: CPU_SAMPLING_INTERVAL_US
});
await inspector.post("Profiler.start");
if (args.heap) {
  await inspector.post("HeapProfiler.enable");
  await inspector.post("HeapProfiler.startSampling", HEAP_SAMPLING);
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
