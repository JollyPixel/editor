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
 * Runs every headless benchmark suite sequentially. Individual files are also
 * runnable on their own (`node bench/flood-fill.bench.ts`).
 */
for (const suite of kSuites) {
  await suite();
}
