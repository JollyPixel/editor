// Import Third-party Dependencies
import fc from "fast-check";

// CONSTANTS
const kDefaultSeed = 20261003;
const kDefaultRuns = 100;

fc.configureGlobal({
  seed: Number(process.env.FC_SEED ?? kDefaultSeed),
  numRuns: Number(process.env.FC_RUNS ?? kDefaultRuns)
});
