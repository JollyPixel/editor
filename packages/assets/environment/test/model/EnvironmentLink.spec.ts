// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  EnvironmentDocument,
  EnvironmentLink,
  type EnvironmentFile
} from "#src/index.ts";

function createLink() {
  const shown: Array<Readonly<EnvironmentFile> | null> = [];
  const documents = new Map<string, EnvironmentDocument>();
  const released: string[] = [];
  const link = new EnvironmentLink(
    (assetId) => {
      const document = documents.get(assetId);

      return document === undefined ? null : {
        document,
        release: () => released.push(assetId)
      };
    },
    (file) => shown.push(file)
  );

  return { link, shown, documents, released };
}

describe("EnvironmentLink", () => {
  test("shows no environment without an asset or for one that does not open", () => {
    const { link, shown } = createLink();

    link.link(null);
    link.link("gone");

    assert.deepEqual(shown, [null, null]);
  });

  test("opens an environment again once it can, after a failed open of the same id", () => {
    const { link, shown, documents } = createLink();

    link.link("late");
    documents.set("late", new EnvironmentDocument());
    link.link("late");

    assert.equal(link.assetId, "late");
    assert.notEqual(shown.at(-1), null);
  });

  test("follows the linked environment as it changes and releases it when relinked", () => {
    const { link, shown, documents, released } = createLink();
    const dusk = new EnvironmentDocument();
    documents.set("dusk", dusk);

    link.link("dusk");
    link.link("dusk");
    dusk.change({ sky: { kind: "night" } });
    assert.deepEqual(shown.at(-1)?.sky, { kind: "night" });

    link.link(null);
    dusk.change({ sky: { kind: "day" } });

    assert.deepEqual(released, ["dusk"]);
    assert.equal(shown.at(-1), null);
    assert.equal(shown.length, 3);
  });
});
