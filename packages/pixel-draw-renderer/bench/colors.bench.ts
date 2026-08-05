// Import Internal Dependencies
import {
  createBench,
  mulberry32,
  reportBench
} from "./_harness.ts";
import {
  colorAsRGBA,
  rgbToHex,
  toRGBA
} from "../src/utils/colors.ts";

// CONSTANTS
const kBatch = 256;

/**
 * `toRGBA`/`colorAsRGBA` route through colorjs.io, so inputs are batched to
 * keep parser cost above harness overhead.
 */
export async function run(): Promise<void> {
  const bench = createBench("Colors (utils/colors)");

  const rng = mulberry32();
  const hexInputs = Array.from({ length: kBatch }, () => randomHex(rng));
  const rgbInputs = Array.from({ length: kBatch }, () => randomRgbString(rng));
  const components = Array.from({ length: kBatch }, () => randomTriplet(rng));

  bench
    .add(`colorAsRGBA / hex string x${kBatch}`, () => {
      let sum = 0;
      for (const input of hexInputs) {
        sum += colorAsRGBA(input)[0];
      }

      return sum;
    })
    .add(`toRGBA / rgb() string x${kBatch}`, () => {
      let sum = 0;
      for (const input of rgbInputs) {
        sum += toRGBA(input).r;
      }

      return sum;
    })
    .add(`rgbToHex / x${kBatch}`, () => {
      let length = 0;
      for (const [r, g, b] of components) {
        length += rgbToHex(r, g, b).length;
      }

      return length;
    });

  await reportBench(bench);
}

function randomChannel(
  rng: () => number
): number {
  return Math.floor(rng() * 256);
}

function randomTriplet(
  rng: () => number
): [number, number, number] {
  return [randomChannel(rng), randomChannel(rng), randomChannel(rng)];
}

function randomHex(
  rng: () => number
): string {
  const [r, g, b] = randomTriplet(rng);

  return rgbToHex(r, g, b);
}

function randomRgbString(
  rng: () => number
): string {
  const [r, g, b] = randomTriplet(rng);

  return `rgb(${r}, ${g}, ${b})`;
}

if (import.meta.main) {
  await run();
}
