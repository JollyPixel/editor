// Import Internal Dependencies
import { run as scheduler } from "./scheduler.bench.ts";
import { run as primitives } from "./primitives.bench.ts";

// CONSTANTS
const kSuites = [
  scheduler,
  primitives
];

for (const suite of kSuites) {
  await suite();
}
