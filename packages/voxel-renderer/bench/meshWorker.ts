// Import Node.js Dependencies
import { parentPort } from "node:worker_threads";

// Import Internal Dependencies
import { runMeshWorker } from "../src/mesh/workers/runMeshWorker.ts";

if (parentPort === null) {
  throw new Error("bench/meshWorker.ts must run as a worker thread.");
}
runMeshWorker(parentPort);
