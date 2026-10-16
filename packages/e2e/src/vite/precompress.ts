// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

// Import Third-party Dependencies
import type { Plugin } from "vite";

// CONSTANTS
const kMinBytes = 1024;
const kCompressible = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".wasm"
]);
const kBrotli = promisify(zlib.brotliCompress);
const kGzip = promisify(zlib.gzip);

export function precompress(): Plugin {
  return {
    name: "jolly-pixel:precompress",
    apply: "build",
    async writeBundle(options, bundle) {
      const directory = options.dir;
      if (directory === undefined) {
        return;
      }

      await Promise.all(
        Object.keys(bundle)
          .filter((fileName) => kCompressible.has(path.extname(fileName)))
          .map((fileName) => writeCompressed(path.join(directory, fileName)))
      );
    }
  };
}

async function writeCompressed(
  file: string
): Promise<void> {
  const content = await fs.readFile(file);
  if (content.length < kMinBytes) {
    return;
  }

  const [brotli, gzip] = await Promise.all([
    kBrotli(content, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length
      }
    }),
    kGzip(content, {
      level: zlib.constants.Z_BEST_COMPRESSION
    })
  ]);
  await Promise.all([
    fs.writeFile(`${file}.br`, brotli),
    fs.writeFile(`${file}.gz`, gzip)
  ]);
}
