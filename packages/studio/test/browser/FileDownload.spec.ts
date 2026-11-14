// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FileDownload } from "../../src/browser/FileDownload.ts";

// CONSTANTS
const kDownload = new FileDownload(new Blob(["zip"]), "Quest-game.zip");

describe("FileDownload.renamed", () => {
  test("keeps the server's file name when the name is blank", () => {
    assert.equal(kDownload.renamed("  "), kDownload);
    assert.equal(kDownload.renamed(" .zip "), kDownload);
  });

  test("renames the download, keeping its extension once", () => {
    const cases = [
      { name: "Quest v2", expected: "Quest v2.zip" },
      { name: " quest.ZIP ", expected: "quest.zip" },
      { name: "builds/quest:final", expected: "builds-quest-final.zip" }
    ];

    for (const { name, expected } of cases) {
      const renamed = kDownload.renamed(name);

      assert.equal(renamed.fileName, expected, name);
      assert.equal(renamed.blob, kDownload.blob);
    }
  });
});
