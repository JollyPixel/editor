// Import Node.js Dependencies
import { fileURLToPath } from "node:url";

export function fileURLToPathExtended(
  file: string | URL
): string {
  return file instanceof URL ?
    fileURLToPath(file) :
    file;
}
