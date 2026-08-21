// Import Node.js Dependencies
import { createHash } from "node:crypto";

/**
 * Content hash used for rename matching and for suppressing the projector's
 * own writes when they come back through the watcher.
 */
export function contentHash(
  data: Uint8Array
): string {
  return createHash("sha256").update(data).digest("hex");
}
