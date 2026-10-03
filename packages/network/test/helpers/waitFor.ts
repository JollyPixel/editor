// Import Node.js Dependencies
import { setImmediate } from "node:timers/promises";

export async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2000
): Promise<void> {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor: timed out");
    }

    await setImmediate();
  }
}
