// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// CONSTANTS
const kSource = path.join(import.meta.dirname, "../src");
const kOutput = path.join(import.meta.dirname, "../dist");
const kAssetExtensions = new Set([".bin"]);

await fs.cp(kSource, kOutput, {
  recursive: true,
  filter: async(source) => {
    const stats = await fs.stat(source);

    return stats.isDirectory() || kAssetExtensions.has(path.extname(source));
  }
});
