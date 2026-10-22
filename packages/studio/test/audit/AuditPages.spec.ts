// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AuditPages,
  type AuditPageSource
} from "../../src/audit/AuditPages.ts";
import type {
  AuditPage,
  AuditQuery,
  AuditRow
} from "../../shared/api/audit.ts";

function settingsRow(
  at: number
): AuditRow {
  return {
    type: "settings",
    actor: {
      id: "alice-id",
      name: "Alice",
      kind: "user"
    },
    at,
    section: "kinds",
    before: {},
    after: {}
  };
}

class PendingPages implements AuditPageSource {
  readonly queries: AuditQuery[] = [];
  #replies: PromiseWithResolvers<AuditPage>[] = [];

  page(
    query: AuditQuery
  ): Promise<AuditPage> {
    this.queries.push(query);
    const reply = Promise.withResolvers<AuditPage>();
    this.#replies.push(reply);

    return reply.promise;
  }

  answer(
    index: number,
    page: AuditPage
  ): void {
    this.#replies[index].resolve(page);
  }

  fail(
    index: number,
    message: string
  ): void {
    this.#replies[index].reject(new Error(message));
  }
}

describe("AuditPages", () => {
  test("keeps the rows of the newest filter when an older reply lands last", async() => {
    const source = new PendingPages();
    const pages = new AuditPages(source);

    const older = pages.filter({ actor: "alice-id" });
    const newer = pages.filter({ actor: "bob-id" });
    source.answer(1, { rows: [settingsRow(2)], next: null });
    await newer;
    source.answer(0, { rows: [settingsRow(1)], next: "cursor" });
    await older;

    assert.deepEqual(pages.rows, [settingsRow(2)]);
    assert.equal(pages.hasMore, false);
    assert.equal(pages.loading, false);
  });

  test("shows the newest failure and ignores one a newer request replaced", async() => {
    const source = new PendingPages();
    const pages = new AuditPages(source);

    const older = pages.reload();
    const newer = pages.reload();
    source.fail(0, "stale");
    await older;
    assert.equal(pages.error, null);
    source.fail(1, "audit refused");
    await newer;

    assert.equal(pages.error, "audit refused");
  });

  test("appends the next page to the rows it has", async() => {
    const source = new PendingPages();
    const pages = new AuditPages(source);

    const first = pages.reload();
    source.answer(0, { rows: [settingsRow(2)], next: "cursor" });
    await first;
    const more = pages.more();
    source.answer(1, { rows: [settingsRow(1)], next: null });
    await more;

    assert.equal(source.queries[1].cursor, "cursor");
    assert.deepEqual(pages.rows, [settingsRow(2), settingsRow(1)]);
  });
});
