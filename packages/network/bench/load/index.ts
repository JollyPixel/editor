// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import {
  LOAD_ARGS,
  choiceArg,
  loadUsage,
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
const kUsage = loadUsage(
  `Starts a network server in a child process and drives it with WebSocket
clients spread over worker threads.`,
  `  --scenario <name>        presence, command or churn (default presence)
  --rooms <n>              rooms the clients spread over (default 5)
  --variants <n>           command variants in the protocol (default 20)
  --snapshot-bytes <n>     snapshot size sent on join (default 65536)
  --rights                 gate every event through a rights table`
);

const { values } = parseArgs({
  options: {
    ...LOAD_ARGS,
    scenario: { type: "string", default: "presence" },
    rooms: { type: "string", default: "5" },
    variants: { type: "string", default: "20" },
    "snapshot-bytes": { type: "string", default: "65536" },
    rights: { type: "boolean", default: false }
  }
});
const args = readLoadArgs(values, kUsage);
const serverConfig: LoadServerConfig = {
  rooms: positiveArg("rooms", values.rooms),
  variants: positiveArg("variants", values.variants),
  snapshotBytes: positiveArg("snapshot-bytes", values["snapshot-bytes"]),
  compression: args.compression,
  rights: values.rights
};
const workload: Workload = {
  scenario: choiceArg("scenario", values.scenario, SCENARIOS),
  rooms: serverConfig.rooms,
  variants: serverConfig.variants
};

const run = await runLoad({
  ...args,
  server: new URL("./server.ts", import.meta.url),
  serverConfig,
  driver: new URL("./driver.ts", import.meta.url),
  workload
});

printLoadResult({
  scenario: workload.scenario,
  clients: args.clients,
  rooms: serverConfig.rooms,
  "rate (Hz)": args.rate,
  compression: serverConfig.compression,
  rights: serverConfig.rights
}, run, args.json);
