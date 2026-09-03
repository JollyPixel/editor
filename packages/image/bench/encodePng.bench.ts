// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  encodePng,
  encodePngWithFilter
} from "../src/png/encodePng.ts";

// CONSTANTS
const kSizes = [64, 256, 1024];

const suite = defineSuite("PNG encoding", (bench) => {
  for (const size of kSizes) {
    const image = tileImage(size);

    bench
      .add(`encodePng / ${size}x${size} / heuristic`, async() => {
        await encodePng(image);
      })
      .add(`encodePng / ${size}x${size} / filter 0`, async() => {
        await encodePngWithFilter(image, 0);
      });
  }
});

function tileImage(
  size: number
): { width: number; height: number; data: Uint8ClampedArray; } {
  const rng = mulberry32();
  const data = new Uint8ClampedArray(size * size * 4);
  const palette = Array.from({ length: 8 }, () => [
    Math.floor(rng() * 256),
    Math.floor(rng() * 256),
    Math.floor(rng() * 256),
    Math.floor(rng() * 256)
  ]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = ((y >> 3) * 3 + (x >> 3)) % palette.length;
      const [r, g, b, a] = palette[tile];
      const to = ((y * size) + x) * 4;
      const dither = (x ^ y) & 3;

      data[to] = r + dither;
      data[to + 1] = g + dither;
      data[to + 2] = b;
      data[to + 3] = a;
    }
  }

  return {
    width: size,
    height: size,
    data
  };
}

async function reportSizes(): Promise<void> {
  for (const size of kSizes) {
    const image = tileImage(size);
    const heuristic = await encodePng(image);
    const flat = await encodePngWithFilter(image, 0);
    const delta = 1 - (heuristic.length / flat.length);

    console.log(
      `${size}x${size}: heuristic ${heuristic.length} B, ` +
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
