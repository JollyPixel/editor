// Import Node.js Dependencies
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TSC_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.resolve("typescript7/package.json"))),
  "bin",
  "tsc"
);
