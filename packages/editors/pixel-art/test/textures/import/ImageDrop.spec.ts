// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ImageDrop } from "../../../src/textures/import/ImageDrop.ts";
import {
  TextureImportError
} from "../../../src/textures/import/errors/TextureImportError.ts";

interface TransferInit {
  types?: string[];
  items?: Partial<DataTransferItem>[];
  files?: File[];
}

function createTransfer(
  init: TransferInit
): DataTransfer {
  const transfer: Pick<DataTransfer, "types" | "items" | "files"> = {
    types: init.types ?? ["Files"],
    items: (init.items ?? []) as unknown as DataTransferItemList,
    files: (init.files ?? []) as unknown as FileList
  };

  return transfer as DataTransfer;
}

function createFile(
  name: string,
  type: string
): File {
  return new File([""], name, { type });
}

describe("ImageDrop", () => {
  test("recognizes a supported file item while the drag file list is protected", () => {
    const drop = new ImageDrop(createTransfer({
      items: [{ kind: "file", type: "image/png" }]
    }));

    assert.ok(drop.carriesFiles);
    assert.ok(drop.supported);
  });

  test("rejects URL and unsupported file drags before showing an overlay", () => {
    const unsupported = new ImageDrop(createTransfer({
      items: [{ kind: "file", type: "image/svg+xml" }]
    }));
    const url = new ImageDrop(createTransfer({
      types: ["text/uri-list"]
    }));

    assert.ok(!unsupported.supported);
    assert.ok(!url.supported);
    assert.ok(!url.carriesFiles);
  });

  test("carries nothing without a data transfer", () => {
    const drop = new ImageDrop(null);

    assert.ok(!drop.carriesFiles);
    assert.ok(!drop.supported);
    assert.throws(() => drop.file(), new TextureImportError("Drop one image file"));
  });

  test("returns the single dropped image, by type or by extension", () => {
    const png = createFile("grass.png", "image/png");
    const untyped = createFile("stone.webp", "");

    assert.equal(new ImageDrop(createTransfer({ files: [png] })).file(), png);
    assert.equal(new ImageDrop(createTransfer({ files: [untyped] })).file(), untyped);
  });

  test("rejects several files, unsupported formats and directories", () => {
    const png = createFile("grass.png", "image/png");
    const several = new ImageDrop(createTransfer({ files: [png, png] }));
    const svg = new ImageDrop(createTransfer({
      files: [createFile("logo.svg", "image/svg+xml")]
    }));
    const directory = new ImageDrop(createTransfer({
      files: [png],
      items: [
        {
          kind: "file",
          type: "",
          webkitGetAsEntry() {
            return { isDirectory: true } as FileSystemEntry;
          }
        }
      ]
    }));

    assert.throws(() => several.file(), new TextureImportError("Drop one image file"));
    assert.throws(() => svg.file(), new TextureImportError("Unsupported image format"));
    assert.throws(() => directory.file(), new TextureImportError("Unsupported image format"));
  });
});
