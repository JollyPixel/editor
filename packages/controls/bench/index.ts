// Import Internal Dependencies
import { run as combination } from "./combination.bench.ts";
import { run as events } from "./events.bench.ts";
import { run as query } from "./query.bench.ts";
import { run as tickActive } from "./tick-active.bench.ts";
import { run as tickIdle } from "./tick-idle.bench.ts";

// CONSTANTS
const kSuites = [
  tickIdle,
  tickActive,
  query,
  combination,
  events
];

/**
 * Runs all headless suites sequentially.
 * Individual suites remain directly runnable.
 */
for (const suite of kSuites) {
  await suite();
}
