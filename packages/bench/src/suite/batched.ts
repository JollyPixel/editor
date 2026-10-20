// Import Third-party Dependencies
import type { Fn } from "tinybench";

// Import Internal Dependencies
import { BenchmarkError } from "../errors/index.ts";

// CONSTANTS
const kBodies = new WeakMap<Fn, () => void>();

export function batched(
  fn: () => void
): () => void {
  function batch(): void {
    throw new BenchmarkError(
      "batched() tasks run only on the bench given to a defineSuite() setup"
    );
  }
  kBodies.set(batch, fn);

  return batch;
}

export function batchedBody(
  fn: Fn
): (() => void) | undefined {
  return kBodies.get(fn);
}
