// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { ChangeSet } from "../../ci/ChangeSet.ts";

describe("ChangeSet.selectors", () => {
  it("selects the workspaces changed since the base and their dependents", () => {
    const changes = new ChangeSet("HEAD~1", ["packages/ui/src/index.ts"], new Set());

    assert.deepEqual(changes.selectors(), ["...[HEAD~1]"]);
  });

  it("adds the importers whose lockfile entries changed", () => {
    const changes = new ChangeSet(
      "HEAD~1",
      ["pnpm-lock.yaml", "packages/ui/package.json"],
      new Set(["packages/ui"])
    );

    assert.deepEqual(changes.selectors(), ["...[HEAD~1]", "...{packages/ui}"]);
  });

  it("selects everything when the lockfile change cannot be attributed", () => {
    const changes = new ChangeSet("HEAD~1", ["pnpm-lock.yaml"], null);

    assert.equal(changes.selectors(), null);
  });

  it("selects everything when a shared file or folder changes", () => {
    for (const file of ["package.json", "tsconfig/base.json", "scripts/workspace/root.ts"]) {
      const changes = new ChangeSet("HEAD~1", [file], new Set());

      assert.equal(changes.selectors(), null, file);
    }
  });
});
