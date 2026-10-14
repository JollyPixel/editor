// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SearchQuery } from "../../src/search/SearchQuery.ts";

describe("SearchQuery", () => {
  test("a blank query is empty and matches every text", () => {
    const query = new SearchQuery("   ");

    assert.ok(query.isEmpty);
    assert.ok(query.matches("Scene"));
    assert.equal(query.rangeIn("Scene"), null);
  });

  test("matching ignores case and surrounding whitespace", () => {
    const query = new SearchQuery("  sCeN ");

    assert.equal(query.text, "sCeN");
    assert.ok(query.matches("Main Scene"));
    assert.deepEqual(query.rangeIn("Main Scene"), { start: 5, end: 9 });
    assert.ok(!query.matches("Camera"));
  });

  test("matching ignores diacritics on either side", () => {
    assert.ok(new SearchQuery("ecole").matches("École"));
    assert.ok(new SearchQuery("école").matches("Ecole"));
  });

  test("a range indexes the original text when folding shortens it", () => {
    const label = "Café Noël";

    assert.deepEqual(
      new SearchQuery("noel").rangeIn(label),
      { start: 6, end: 10 }
    );
  });

  test("queries that fold to the same text are equal", () => {
    assert.ok(new SearchQuery("Noël").equals(new SearchQuery(" noel ")));
    assert.ok(!new SearchQuery("noe").equals(new SearchQuery("noel")));
  });
});
