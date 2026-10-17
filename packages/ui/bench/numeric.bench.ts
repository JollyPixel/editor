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
  createBatch,
  type Rng
} from "./_fixtures.ts";

// CONSTANTS
const kBounds = {
  step: 0.1,
  min: -1000,
  max: 1000
};

const suite = defineSuite("numeric", (bench) => {
  const plain = createBatch((rng) => (rng() * 200 - 100).toFixed(2));
  const expressions = createBatch(expression);
  const integers = createBatch((rng) => Math.round(rng() * 400 - 200));
  const decimals = createBatch((rng) => Math.round(rng() * 1e4) / 100);
  const doubles = createBatch((rng) => rng() * 100);
  const deltas = createBatch((rng) => Math.round(rng() * 400 - 200));

  bench
    .add("evaluate plain", () => sumBy(plain, (text) => valueOf(evaluate(text))))
    .add("evaluate expression", () => sumBy(expressions, (text) => valueOf(evaluate(text))))
    .add("parseNumericEntry", () => sumBy(
      expressions,
      (text) => valueOf(parseNumericEntry(text, kBounds))
    ))
    .add("formatNumber integer step 1", () => sumBy(
      integers,
      (value) => formatNumber(value, 1).length
    ))
    .add("formatNumber 2dp step 0.01", () => sumBy(
      decimals,
      (value) => formatNumber(value, 0.01).length
    ))
    .add("formatNumber double step 0.01", () => sumBy(
      doubles,
      (value) => formatNumber(value, 0.01).length
    ))
    .add("quantize step 0.1", () => sumBy(
      doubles,
      (value) => quantize(value, 0.1, -50, 50)
    ))
    .add("valueFromDelta", () => sumBy(
      deltas,
      (deltaPx) => valueFromDelta({
        start: 1.25,
        deltaPx,
        step: 0.05
      })
    ))
    .add("valueFromDelta known precision", () => sumBy(
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

function sumBy<T>(
  items: T[],
  read: (item: T) => number
): number {
  let sum = 0;
  for (const item of items) {
    sum += read(item);
  }

  return sum;
}
