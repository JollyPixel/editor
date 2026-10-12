// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AttachmentDisposition } from "../../src/project/AttachmentDisposition.ts";

describe("AttachmentDisposition", () => {
  test("round-trips a file name with quotes, spaces and non-ASCII letters", () => {
    const fileName = "l'été (v2)*.zip";
    const header = new AttachmentDisposition(fileName).toString();

    assert.match(header, /^attachment; filename\*=UTF-8''[\w%.~!-]+$/);
    assert.equal(AttachmentDisposition.parse(header)?.fileName, fileName);
  });

  test("parses nothing from a missing or malformed header", () => {
    for (const header of [
      null,
      "attachment",
      "attachment; filename*=UTF-8''%E0%A4%A"
    ]) {
      assert.equal(AttachmentDisposition.parse(header), null);
    }
  });
});
