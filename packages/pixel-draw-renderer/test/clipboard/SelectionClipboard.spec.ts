// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SelectionClipboard } from "#src/clipboard/SelectionClipboard.ts";
import { encodeSelectionMetadata } from "#src/clipboard/selectionMetadata.ts";
import {
  JOLLYPIXEL_CLIPBOARD_TYPE,
  type ClipboardAdapter,
  type DecodedRasterImage,
  type SelectionSnapshot
} from "#src/clipboard/types.ts";

// CONSTANTS
const kSnapshot: SelectionSnapshot = {
  rect: { x: -2, y: 4, width: 2, height: 1 },
  pixels: [
    { r: 1, g: 2, b: 3, a: 4 },
    { r: 5, g: 6, b: 7, a: 128 }
  ],
  mask: [true, false]
};

const kImage: DecodedRasterImage = {
  width: 2,
  height: 1,
  pixels: kSnapshot.pixels
};

function makeItem(
  data: Record<string, Blob>
): ClipboardItem {
  return {
    types: Object.keys(data),
    presentationStyle: "unspecified",
    getType: async(type: string) => data[type]
  };
}

function makeAdapter(
  options: {
    read?: () => Promise<ClipboardItem[]>;
    write?: (items: ClipboardItem[]) => Promise<void>;
  } = {}
): ClipboardAdapter {
  return {
    read: options.read ?? (async() => []),
    write: options.write ?? (async() => undefined)
  };
}

describe("SelectionClipboard", () => {
  const previousClipboardItem = Object.getOwnPropertyDescriptor(
    globalThis,
    "ClipboardItem"
  );
  before(() => {
    Object.assign(globalThis, {
      ClipboardItem: window.ClipboardItem
    });
  });
  after(() => {
    if (previousClipboardItem === undefined) {
      Reflect.deleteProperty(globalThis, "ClipboardItem");
    }
    else {
      Object.defineProperty(globalThis, "ClipboardItem", previousClipboardItem);
    }
  });

  test("writes PNG plus custom metadata when the custom type is supported", async() => {
    let written: ClipboardItem[] = [];
    const clipboard = new SelectionClipboard({
      adapter: makeAdapter({
        write: async(items) => {
          written = items;
        }
      }),
      supportsType: (type) => type === JOLLYPIXEL_CLIPBOARD_TYPE
    });

    const result = await clipboard.copy(kSnapshot);

    assert.strictEqual(result.code, "copied");
    assert.deepStrictEqual(
      written[0].types,
      ["image/png", JOLLYPIXEL_CLIPBOARD_TYPE]
    );
  });

  test("writes PNG only when custom formats are unavailable", async() => {
    let written: ClipboardItem[] = [];
    const clipboard = new SelectionClipboard({
      adapter: makeAdapter({
        write: async(items) => {
          written = items;
        }
      }),
      supportsType: () => false
    });

    await clipboard.copy(kSnapshot);

    assert.deepStrictEqual(written[0].types, ["image/png"]);
  });

  test("keeps a defensive internal copy when system write fails", async() => {
    const adapter = makeAdapter({
      read: async() => {
        throw new Error("denied");
      },
      write: async() => {
        throw new Error("denied");
      }
    });
    const clipboard = new SelectionClipboard({
      adapter
    });

    const input = structuredClone(kSnapshot);
    const copyResult = await clipboard.copy(input);
    input.pixels[0].r = 99;
    const pasteResult = await clipboard.read(8);

    assert.strictEqual(copyResult.code, "copied-internal-only");
    assert.strictEqual(pasteResult.result.source, "internal");
    assert.strictEqual(pasteResult.selection!.pixels[0].r, 1);
  });

  test("does not use stale internal data after a readable system clipboard has no image", async() => {
    const adapter = makeAdapter({
      read: async() => [makeItem({ "text/plain": new Blob(["text"]) })],
      write: async() => {
        throw new Error("denied");
      }
    });
    const clipboard = new SelectionClipboard({
      adapter
    });
    await clipboard.copy(kSnapshot);

    const result = await clipboard.read(8);

    assert.strictEqual(result.result.code, "no-image");
    assert.strictEqual(result.selection, undefined);
  });

  test("accepts each supported raster type through the decoder", async() => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      const clipboard = new SelectionClipboard({
        adapter: makeAdapter({
          read: async() => [makeItem({ [type]: new Blob([type], { type }) })]
        }),
        decodeRaster: async() => kImage
      });

      const result = await clipboard.read(8);

      assert.strictEqual(result.result.code, "pasted");
      assert.deepStrictEqual(
        result.selection,
        {
          width: 2,
          height: 1,
          pixels: kImage.pixels,
          mask: [true, true]
        }
      );
    }
  });

  test("our own metadata pixels supersede the PNG raster", async() => {
    const exact = [
      { r: 200, g: 100, b: 50, a: 3 },
      { r: 5, g: 6, b: 7, a: 128 }
    ];
    const clipboard = new SelectionClipboard({
      adapter: makeAdapter({
        read: async() => [makeItem({
          "image/png": new Blob(["png"]),
          [JOLLYPIXEL_CLIPBOARD_TYPE]: new Blob([
            JSON.stringify(
              encodeSelectionMetadata({
                rect: { x: 0, y: 0, width: 2, height: 1 },
                pixels: exact,
                mask: [true, true]
              })
            )
          ])
        })]
      }),
      decodeRaster: async() => {
        return {
          width: 2,
          height: 1,
          pixels: [
            { r: 170, g: 85, b: 85, a: 3 },
            { r: 5, g: 6, b: 7, a: 128 }
          ]
        };
      }
    });

    const result = await clipboard.read(8);

    assert.deepStrictEqual(result.selection!.pixels, exact);
  });
});
