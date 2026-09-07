// Import Node.js Dependencies
import { createHash } from "node:crypto";

export function contentHash(
  data: Uint8Array
): string {
  return createHash("sha256")
    .update(data)
    .digest("hex");
}
