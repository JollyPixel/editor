// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import {
  LOAD_ARGS,
  choiceArg,
  loadUsage,
  nonNegativeArg,
  positiveArg,
  printLoadResult,
  readLoadArgs,
  runLoad
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  SCENARIOS,
  type LoadServerConfig,
  type Workload
} from "./protocol.ts";

// CONSTANTS
const kStores = ["sqlite", "memory"] as const;
const kUsage = loadUsage(
  `Starts an asset backend in a child process and drives it with WebSocket and
HTTP clients spread over worker threads.`,
  `  --scenario <name>        edit, join, catalog, http or open (default edit)
  --assets <n>             binary assets in the catalog (default 1000)
  --grids <n>              live grid assets, one room each (default 5)
  --content-bytes <n>      grid content size (default 65536)
  --store <kind>           sqlite or memory event store (default sqlite)
  --grace <ms>             asset room grace period (default 0)
  --snapshot-delay <ms>    quiet period before a snapshot (default 2000)
  --etag                   send If-None-Match in the http scenario`
);

const { values } = parseArgs({
  options: {
    ...LOAD_ARGS,
    scenario: { type: "string", default: "edit" },
    assets: { type: "string", default: "1000" },
    grids: { type: "string", default: "5" },
    "content-bytes": { type: "string", default: "65536" },
    store: { type: "string", default: "sqlite" },
    grace: { type: "string", default: "0" },
    "snapshot-delay": { type: "string", default: "2000" },
    etag: { type: "boolean", default: false }
  }
});
const args = readLoadArgs(values, kUsage);
const scenario = choiceArg("scenario", values.scenario, SCENARIOS);
const serverConfig: LoadServerConfig = {
  assets: positiveArg("assets", values.assets),
  grids: positiveArg("grids", values.grids),
  contentBytes: positiveArg("content-bytes", values["content-bytes"]),
  store: choiceArg("store", values.store, kStores),
  graceMs: nonNegativeArg("grace", values.grace),
  snapshotDelayMs: nonNegativeArg("snapshot-delay", values["snapshot-delay"]),
  compression: args.compression
};
if (scenario === "catalog" && serverConfig.assets < args.clients) {
  throw new Error("--assets must be at least --clients for catalog");
}
const workload: Workload = {
  scenario,
  grids: serverConfig.grids,
  etag: values.etag
};

const run = await runLoad({
  ...args,
  server: new URL("./server.ts", import.meta.url),
  serverConfig,
  driver: new URL("./driver.ts", import.meta.url),
  workload
});

printLoadResult({
  scenario,
  clients: args.clients,
  "rate (Hz)": args.rate,
  assets: serverConfig.assets,
  grids: serverConfig.grids,
  "content (KB)": serverConfig.contentBytes / 1_024,
  store: serverConfig.store
}, run, args.json);
