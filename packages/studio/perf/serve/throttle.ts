// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { startThrottleProxy } from "@jolly-pixel/cdp";

const { values: args } = parseArgs({
  options: {
    listen: { type: "string" },
    target: { type: "string" },
    mbps: { type: "string", default: "8.1" },
    rtt: { type: "string", default: "165" }
  }
});
if (args.listen === undefined || args.target === undefined) {
  throw new TypeError("--listen <port> and --target <port> are required");
}

await startThrottleProxy({
  port: Number(args.listen),
  targetPort: Number(args.target),
  mbps: Number(args.mbps),
  rttMs: Number(args.rtt)
});
console.info(
  `localhost:${args.listen} -> localhost:${args.target} ` +
  `at ${args.mbps} Mbit/s, ${args.rtt} ms RTT`
);
