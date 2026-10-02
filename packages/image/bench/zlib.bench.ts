// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  adaptiveFilter,
  filterScanlines
} from "../src/png/filters.ts";
import {
  deflate,
  inflate
} from "../src/png/zlib.ts";
import {
  SIZES,
  rgbaImage
} from "./_fixtures.ts";

// CONSTANTS
const kChannels = 4;

const suite = defineSuite("png / zlib", async(bench) => {
  for (const size of SIZES) {
    const filtered = filterScanlines(
      rgbaImage(size).data,
      size,
      size,
      kChannels,
      adaptiveFilter
    );
    const compressed = new Uint8Array(await deflate(filtered));

    bench
      .add(`deflate / ${size}x${size}`, async() => {
        await deflate(filtered);
      })
      .add(`inflate / ${size}x${size}`, async() => {
        await inflate(compressed, filtered.length);
      });
  }
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
