// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TextureDocument } from "#src/document/TextureDocument.ts";
import { TextureFile } from "#src/file/TextureFile.ts";
import { TexturePreview } from "#src/image/TexturePreview.ts";

// CONSTANTS
const kIdentifier = [
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
];

function ktx2File(
  width: number
): Uint8Array {
  const bytes = new Uint8Array(48);
  bytes.set(kIdentifier);
  const view = new DataView(bytes.buffer);
  view.setUint32(20, width, true);
  view.setUint32(24, width, true);

  return bytes;
}

function skyPreview(): {
  document: TextureDocument;
  preview: TexturePreview;
} {
  const document = new TextureDocument();
  const file = new TextureFile({
    targetRecord: {
      id: "sky",
      path: "textures/sky.ktx2"
    },
    catalog: {
      replace: () => Promise.reject(new Error("not used"))
    }
  }, document);

  return {
    document,
    preview: new TexturePreview(file)
  };
}

function headerWidth(
  preview: TexturePreview
): number | null {
  const { view } = preview;

  return view.status === "header" ? view.header.width : null;
}

async function settled(
  preview: TexturePreview
): Promise<void> {
  while (preview.view.status === "loading") {
    await new Promise<void>((resolve) => {
      const unsubscribe = preview.subscribe("change", () => {
        unsubscribe();
        resolve();
      });
    });
  }
}

describe("TexturePreview", () => {
  test("follows the file through a replacement and empties the view when released", async() => {
    const { document, preview } = skyPreview();
    document.load(ktx2File(512));
    const release = preview.follow();
    await settled(preview);

    assert.equal(headerWidth(preview), 512);

    document.load(ktx2File(64));
    await settled(preview);

    assert.equal(headerWidth(preview), 64);

    release();

    assert.equal(preview.view.status, "empty");
  });

  test("reports a file that cannot be read", async() => {
    const { document, preview } = skyPreview();
    document.load(new Uint8Array([1, 2, 3]));
    preview.follow();
    await settled(preview);

    assert.deepEqual(preview.view, {
      status: "failed",
      error: "The file is not a KTX2 texture."
    });
  });

  test("shows nothing for an empty file", async() => {
    const { document, preview } = skyPreview();
    document.load(new Uint8Array());
    preview.follow();
    await settled(preview);

    assert.equal(preview.view.status, "empty");
  });
});
