// Import Internal Dependencies
import { run as colors } from "./colors.bench.ts";
import { run as floodFill } from "./flood-fill.bench.ts";
import { run as history } from "./history.bench.ts";
import { run as network } from "./network.bench.ts";
import { run as pixelBuffer } from "./pixel-buffer.bench.ts";

// CONSTANTS
const kSuites = [
  floodFill,
  pixelBuffer,
  history,
  network,
  colors
];

/**
 * Runs all headless suites sequentially.
 * Individual suites remain directly runnable.
 */
for (const suite of kSuites) {
  await suite();
}
