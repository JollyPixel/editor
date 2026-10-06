// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MATCH_TIERS,
  score,
  scoreTypo
} from "#src/search/score.ts";

function highlighted(
  query: string,
  candidate: string
): string {
  const found = score(query, candidate);
  assert.ok(found, `${query} should match ${candidate}`);

  let text = "";
  let cursor = 0;
  for (const { start, end } of found.ranges) {
    text += `${candidate.slice(cursor, start)}[${candidate.slice(start, end)}]`;
    cursor = end;
  }

  return text + candidate.slice(cursor);
}

describe("score tiers", () => {
  const tables: [keyof typeof MATCH_TIERS, [string, string, string][]][] = [
    ["exact", [
      ["brush.size", "brush.size", "[brush.size]"],
      ["FPS", "fps", "[fps]"]
    ]],
    ["prefix", [
      ["brush.s", "brush.size", "[brush.s]ize"],
      ["he", "help", "[he]lp"]
    ]],
    ["wordBoundary", [
      ["bs", "brush.size", "[b]rush.[s]ize"],
      ["brsi", "brush.size", "[br]ush.[si]ze"],
      ["size", "brush.size", "brush.[size]"],
      ["gaf", "git.autoFetch", "[g]it.[a]uto[F]etch"],
      ["fy", "brush.flipY", "brush.[f]lip[Y]"],
      ["rm", "brush.rotation-mode", "brush.[r]otation-[m]ode"]
    ]],
    ["substring", [
      ["ush", "brush.size", "br[ush].size"],
      ["etc", "git.autoFetch", "git.autoF[etc]h"]
    ]],
    ["subsequence", [
      ["bze", "brush.size", "[b]rush.si[ze]"],
      ["hsz", "brush.size", "brus[h].[s]i[z]e"]
    ]]
  ];

  for (const [tier, rows] of tables) {
    describe(tier, () => {
      for (const [query, candidate, expected] of rows) {
        test(`"${query}" in "${candidate}"`, () => {
          assert.equal(score(query, candidate)?.tier, MATCH_TIERS[tier]);
          assert.equal(highlighted(query, candidate), expected);
        });
      }
    });
  }

  test("no match", () => {
    assert.equal(score("xyz", "brush.size"), null);
    assert.equal(score("", "brush.size"), null);
    assert.equal(score("brush.size.extra", "brush.size"), null);
  });
});

describe("score within a tier", () => {
  test("a prefix covering more of the candidate ranks higher", () => {
    const short = score("he", "help");
    const long = score("he", "helpers");

    assert.ok(short && long && short.score > long.score);
  });

  test("a tighter subsequence ranks higher", () => {
    const tight = score("bze", "bxze");
    const loose = score("bze", "bxxxxxze");

    assert.ok(tight && loose && tight.score > loose.score);
  });
});

describe("scoreTypo", () => {
  test("matches a mistyped word start with no highlight", () => {
    assert.deepEqual(scoreTypo("brush.sise", "brush.size"), {
      tier: MATCH_TIERS.typo,
      score: 0.9,
      ranges: []
    });
    assert.equal(scoreTypo("sise", "brush.size")?.tier, MATCH_TIERS.typo);
  });

  test("score never tolerates typos on its own", () => {
    assert.equal(score("brush.sise", "brush.size"), null);
  });

  test("rejects short queries and distant words", () => {
    assert.equal(scoreTypo("siz", "brush.rize"), null);
    assert.equal(scoreTypo("camera", "brush.size"), null);
  });
});
