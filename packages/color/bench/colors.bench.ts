// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { formatHex8 } from "../src/format.ts";
import { parseColor } from "../src/parse/index.ts";

// CONSTANTS
const kBatch = 256;

/**
 * Parsing is the hot path: inputs are batched so the grammar dominates
 * harness overhead. The baseline these numbers replace is colorjs.io, which
 * `pixel-draw-renderer` routed every color through before this package.
 */
const suite = defineSuite("Colors (parse and format)", (bench) => {
  const rng = mulberry32();
  const hexInputs = Array.from({ length: kBatch }, () => randomHex(rng));
  const rgbInputs = Array.from({ length: kBatch }, () => randomRgbString(rng));
  const hslInputs = Array.from({ length: kBatch }, () => randomHslString(rng));
  const namedInputs = Array.from({ length: kBatch }, () => randomName(rng));
  const components = Array.from({ length: kBatch }, () => randomTriplet(rng));

  bench
    .add(`parseColor / hex string x${kBatch}`, () => sumChannels(hexInputs))
    .add(`parseColor / rgb() string x${kBatch}`, () => sumChannels(rgbInputs))
    .add(`parseColor / hsl() string x${kBatch}`, () => sumChannels(hslInputs))
    .add(`parseColor / named color x${kBatch}`, () => sumChannels(namedInputs))
    .add(`formatHex8 / x${kBatch}`, () => {
      let length = 0;
      for (const [r, g, b] of components) {
        length += formatHex8({
          r,
          g,
          b,
          a: 255
        }).length;
      }

      return length;
    });
});

export default suite;

// CONSTANTS
const kNames = [
  "red",
  "cornflowerblue",
  "rebeccapurple",
  "darkslategrey",
  "papayawhip"
];

function sumChannels(
  inputs: string[]
): number {
  let sum = 0;
  for (const input of inputs) {
    sum += parseColor(input)?.r ?? 0;
  }

  return sum;
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

  return formatHex8({
    r,
    g,
    b,
    a: 255
  });
}

function randomRgbString(
  rng: () => number
): string {
  const [r, g, b] = randomTriplet(rng);

  return `rgb(${r}, ${g}, ${b})`;
}

function randomHslString(
  rng: () => number
): string {
  const [h, s, l] = randomTriplet(rng);

  return `hsl(${h % 360}, ${s % 101}%, ${l % 101}%)`;
}

function randomName(
  rng: () => number
): string {
  return kNames[Math.floor(rng() * kNames.length)];
}

if (import.meta.main) {
  await runSuites([suite]);
}
