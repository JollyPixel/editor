// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  encodePng,
  encodePngWith
} from "../src/png/encodePng.ts";
import { fixedFilter } from "../src/png/filters.ts";
import {
  SIZES,
  rgbaImage
} from "./_fixtures.ts";

const suite = defineSuite("png / encodePng", (bench) => {
  for (const size of SIZES) {
    const image = rgbaImage(size);

    bench
      .add(`${size}x${size} / adaptive`, async() => {
        await encodePng(image);
      })
      .add(`${size}x${size} / filter 0`, async() => {
        await encodePngWith(image, fixedFilter(0));
      });
  }
});

async function reportSizes(): Promise<void> {
  for (const size of SIZES) {
    const image = rgbaImage(size);
    const adaptive = await encodePng(image);
    const flat = await encodePngWith(image, fixedFilter(0));
    const delta = 1 - (adaptive.length / flat.length);

    console.log(
      `${size}x${size}: adaptive ${adaptive.length} B, ` +
      `filter 0 ${flat.length} B, ` +
      `${(delta * 100).toFixed(1)}% smaller`
    );
  }
}

export default suite;

if (import.meta.main) {
  await reportSizes();
  await runSuites([suite]);
}
