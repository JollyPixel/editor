// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  hasSupportedImageDrag
} from "../../../src/textures/import/textureDropFiles.ts";

describe("textureDropFiles", () => {
  test("recognizes a supported file item while the drag file list is protected", () => {
    const item = {
      kind: "file",
      type: "image/png"
    } as DataTransferItem;
    const transfer = {
      files: { length: 0 },
      items: [item],
      types: ["Files"]
    } as unknown as DataTransfer;

    assert.ok(hasSupportedImageDrag(transfer));
  });

  test("rejects URL and unsupported file drags before showing an overlay", () => {
    const unsupported = {
      kind: "file",
      type: "image/svg+xml"
    } as DataTransferItem;

    assert.ok(!hasSupportedImageDrag({
      files: { length: 0 },
      items: [unsupported],
      types: ["Files"]
    } as unknown as DataTransfer));
    assert.ok(!hasSupportedImageDrag({
      files: { length: 0 },
      items: [],
      types: ["text/uri-list"]
    } as unknown as DataTransfer));
  });
});
