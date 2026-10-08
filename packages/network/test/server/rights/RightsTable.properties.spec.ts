// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import {
  RightsTable,
  type Right
} from "#src/index.ts";

// CONSTANTS
const kRole = "role";
const kKeyChars = ["a", "b", ".", "/", "$", "?", "[", "]", "{", "}", "!", "(", ")", "+", "\\"];

const kKey = fc.string({
  unit: fc.constantFrom(...kKeyChars),
  maxLength: 8
});
const kPattern = fc.string({
  unit: fc.constantFrom(...kKeyChars, "*"),
  maxLength: 6
});
const kRight = fc.constantFrom<Right>("read", "write", "void");

function documentedMatch(
  pattern: string,
  key: string
): boolean {
  const literals = pattern
    .split("*")
    .map((literal) => literal.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"));

  return new RegExp(`^${literals.join("[\\s\\S]*")}$`).test(key);
}

describe("RightsTable properties", () => {
  test("a pattern matches as documented: * matches anything, every other character is literal", () => {
    fc.assert(
      fc.property(kPattern, kKey, (pattern, key) => {
        const table = new RightsTable({
          [kRole]: { [pattern]: "write" }
        });
        const expected = documentedMatch(pattern, key) ? "write" : "void";

        assert.strictEqual(table.check(kRole, key), expected);
      })
    );
  });

  test("a pattern matches every key it was derived from", () => {
    fc.assert(
      fc.property(
        fc.array(kKey, { minLength: 1, maxLength: 4 }),
        fc.array(fc.boolean(), { maxLength: 4 }),
        (parts, wildcards) => {
          const key = parts.join("");
          const pattern = parts
            .map((part, index) => (wildcards[index] === true ? "*" : part))
            .join("");
          const table = new RightsTable({
            [kRole]: { [pattern]: "read" }
          });

          assert.strictEqual(table.check(kRole, key), "read");
        }
      )
    );
  });

  test("a rule put first decides the keys it matches and leaves every other key alone", () => {
    fc.assert(
      fc.property(
        fc.dictionary(kPattern, kRight, { maxKeys: 4 }),
        kPattern,
        kRight,
        fc.array(kKey, { maxLength: 8 }),
        (rules, pattern, right, keys) => {
          fc.pre(!Object.hasOwn(rules, pattern));
          const before = new RightsTable({ [kRole]: rules });
          const after = new RightsTable({
            [kRole]: { [pattern]: right, ...rules }
          });

          for (const key of keys) {
            assert.strictEqual(
              after.check(kRole, key),
              documentedMatch(pattern, key) ? right : before.check(kRole, key)
            );
          }
        }
      )
    );
  });
});
