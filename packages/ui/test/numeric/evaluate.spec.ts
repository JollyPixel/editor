// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { evaluate } from "../../src/numeric/evaluate.ts";

function value(
  input: string
): number {
  const result = evaluate(input);
  assert.equal(result.ok, true, `expected "${input}" to parse`);

  return result.ok ? result.value : Number.NaN;
}

function error(
  input: string
): string {
  const result = evaluate(input);
  assert.equal(result.ok, false, `expected "${input}" to fail`);

  return result.ok ? "" : result.error;
}

describe("Numeric.evaluate", () => {
  describe("plain numbers", () => {
    test("parses integers, decimals and signs", () => {
      assert.equal(value("42"), 42);
      assert.equal(value("-42"), -42);
      assert.equal(value("+42"), 42);
      assert.equal(value("1.5"), 1.5);
      assert.equal(value(".5"), 0.5);
      assert.equal(value("  7  "), 7);
    });

    test("parses scientific notation", () => {
      assert.equal(value("1e3"), 1000);
      assert.equal(value("1.5e-2"), 0.015);
    });

    test("accepts a comma as a decimal separator", () => {
      assert.equal(value("1,5"), 1.5);
      assert.equal(value(",5"), 0.5);
      assert.equal(value("1,5*2"), 3);
    });
  });

  describe("arithmetic", () => {
    test("evaluates the four operators", () => {
      assert.equal(value("1920/2"), 960);
      assert.equal(value("2+3"), 5);
      assert.equal(value("10-4"), 6);
      assert.equal(value("6*7"), 42);
    });

    test("respects precedence", () => {
      assert.equal(value("2+3*4"), 14);
      assert.equal(value("2*3+4"), 10);
      assert.equal(value("100-10/2"), 95);
    });

    test("respects parentheses", () => {
      assert.equal(value("(2+3)*4"), 20);
      assert.equal(value("((1+2))*3"), 9);
      assert.equal(value("2*(3+(4-1))"), 12);
    });

    test("handles unary sign, including after an operator", () => {
      assert.equal(value("-2+3"), 1);
      assert.equal(value("3*-2"), -6);
      assert.equal(value("-(2+3)"), -5);
      assert.equal(value("--3"), 3);
      assert.equal(value("3-+2"), 1);
    });

    test("is left associative for equal precedence", () => {
      assert.equal(value("10-3-2"), 5);
      assert.equal(value("100/5/2"), 10);
    });
  });

  describe("non finite results", () => {
    test("rejects division by zero rather than returning Infinity", () => {
      assert.equal(error("1/0"), "Division by zero");
      assert.equal(error("1/(2-2)"), "Division by zero");
    });

    test("rejects an overflowing result", () => {
      assert.match(error("1e308*10"), /finite/);
    });
  });

  describe("grammar closure", () => {
    test("rejects identifiers, so nothing eval shaped parses", () => {
      assert.match(error("alert(1)"), /Unexpected character/);
      assert.match(error("constructor"), /Unexpected character/);
      assert.match(error("__proto__"), /Unexpected character/);
      assert.match(error("a.b"), /Unexpected character/);
      assert.match(error("\"1\"+\"2\""), /Unexpected character/);
    });

    test("rejects operators the grammar does not define", () => {
      assert.match(error("2**3"), /no left operand/);
      assert.match(error("7%2"), /Unexpected character/);
      assert.match(error("1&2"), /Unexpected character/);
    });

    test("rejects hexadecimal, which Number() would otherwise accept", () => {
      assert.match(error("0x10"), /Unexpected character/);
    });
  });

  describe("malformed input", () => {
    test("rejects an empty expression", () => {
      assert.equal(error(""), "Expression is empty");
      assert.equal(error("   "), "Expression is empty");
    });

    test("rejects a trailing operator", () => {
      assert.match(error("1+"), /ends with an operator/);
      assert.match(error("1*"), /ends with an operator/);
    });

    test("rejects unbalanced parentheses", () => {
      assert.match(error("(1+2"), /Unbalanced parenthesis/);
      assert.match(error("1+2)"), /Unbalanced parenthesis/);
    });

    test("rejects juxtaposed values", () => {
      assert.match(error("1 2"), /Malformed expression/);
    });
  });
});
