// Import Node.js Dependencies
import { cpSync } from "node:fs";
import path from "node:path";

// CONSTANTS
const kRootDir = path.join(import.meta.dirname, "..");
const kAssets = [
  "src/persistence/sqlite/schema.sql"
];

for (const asset of kAssets) {
  const dest = path.join(kRootDir, "dist", path.relative("src", asset));
  cpSync(path.join(kRootDir, asset), dest);
}
