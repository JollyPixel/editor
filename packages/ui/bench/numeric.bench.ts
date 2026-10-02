// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  formatNumber,
  parseNumericEntry,
  quantize
} from "../src/numeric/entry.ts";
import { evaluate } from "../src/numeric/evaluate.ts";
import { valueFromDelta } from "../src/numeric/valueFromDelta.ts";
import {
  BATCH,
  batchOf,
  type Rng
} from "./_fixtures.ts";

// CONSTANTS
const kBounds = {
  step: 0.1,
  min: -1000,
  max: 1000
};

const suite = defineSuite("numeric", (bench) => {
  const plain = batchOf((rng) => (rng() * 200 - 100).toFixed(2));
  const expressions = batchOf(expression);
  const integers = batchOf((rng) => Math.round(rng() * 400 - 200));
  const decimals = batchOf((rng) => Math.round(rng() * 1e4) / 100);
  const doubles = batchOf((rng) => rng() * 100);
  const deltas = batchOf((rng) => Math.round(rng() * 400 - 200));

  bench
    .add("evaluate plain", () => sumOf(plain, (text) => valueOf(evaluate(text))))
    .add("evaluate expression", () => sumOf(expressions, (text) => valueOf(evaluate(text))))
    .add("parseNumericEntry", () => sumOf(
      expressions,
      (text) => valueOf(parseNumericEntry(text, kBounds))
    ))
    .add("formatNumber integer step 1", () => sumOf(
      integers,
      (value) => formatNumber(value, 1).length
    ))
    .add("formatNumber 2dp step 0.01", () => sumOf(
      decimals,
      (value) => formatNumber(value, 0.01).length
    ))
    .add("formatNumber double step 0.01", () => sumOf(
      doubles,
      (value) => formatNumber(value, 0.01).length
    ))
    .add("quantize step 0.1", () => sumOf(
      doubles,
      (value) => quantize(value, 0.1, -50, 50)
    ))
    .add("valueFromDelta", () => sumOf(
      deltas,
      (deltaPx) => valueFromDelta({
        start: 1.25,
        deltaPx,
        step: 0.05
      })
    ))
    .add("valueFromDelta known precision", () => sumOf(
      deltas,
      (deltaPx) => valueFromDelta({
        start: 1.25,
        deltaPx,
        step: 0.05,
        precision: 2
      })
    ));
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}

function expression(
  rng: Rng
): string {
  const a = (rng() * 100).toFixed(1);
  const b = Math.round(rng() * 9) + 1;
  const c = (rng() * 10).toFixed(2);

  return `(${a} + ${b}) * -${c} / 4`;
}

function valueOf(
  result: { ok: true; value: number; } | { ok: false; } | null
): number {
  return result?.ok ? result.value : 0;
}

function sumOf<T>(
  items: T[],
  read: (item: T) => number
): number {
  let sum = 0;
  for (const item of items) {
    sum += read(item);
  }

  return sum;
}
