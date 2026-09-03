// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { decodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import { SelectionClipboard } from "#src/clipboard/SelectionClipboard.ts";
import { encodeSelectionPng } from "#src/clipboard/selectionImage.ts";
import { encodeSelectionMetadata } from "#src/clipboard/selectionMetadata.ts";
import {
  JOLLYPIXEL_CLIPBOARD_TYPE,
  SUPPORTED_RASTER_TYPES,
  type ClipboardAdapter,
  type DecodedRasterImage,
  type SelectionSnapshot
} from "#src/clipboard/types.ts";

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
  test("writes PNG plus custom metadata when the custom type is supported", async() => {
    let written: ClipboardItem[] = [];
    const clipboard = new SelectionClipboard({
      adapter: makeAdapter({
        write: async(items) => {
          written = items;
        }
      }),
      encodePng: async() => new Blob(["png"], { type: "image/png" }),
      createItem: makeItem,
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
      encodePng: async() => new Blob(["png"], { type: "image/png" }),
      createItem: makeItem,
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
      adapter,
      encodePng: async() => new Blob(["png"]),
      createItem: makeItem
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
      adapter,
      encodePng: async() => new Blob(["png"]),
      createItem: makeItem
    });
    await clipboard.copy(kSnapshot);

    const result = await clipboard.read(8);

    assert.strictEqual(result.result.code, "no-image");
    assert.strictEqual(result.selection, undefined);
  });

  test("accepts each supported raster type through the decoder", async() => {
    for (const type of SUPPORTED_RASTER_TYPES) {
      const clipboard = new SelectionClipboard({
        adapter: makeAdapter({
          read: async() => [makeItem({ [type]: new Blob([type], { type }) })]
        }),
        decodeRaster: async() => kImage,
        createItem: makeItem
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

  test("read returns unplaced content, leaving placement to the caller", async() => {
    const clipboard = new SelectionClipboard({
      adapter: makeAdapter({
        read: async() => [makeItem({ "image/png": new Blob(["png"]) })]
      }),
      decodeRaster: async() => kImage,
      createItem: makeItem
    });

    const { selection } = await clipboard.read(8);

    assert.ok(selection);
    assert.ok(!("rect" in selection));
  });

  test("external images preserve partial alpha and mask out alpha zero", async() => {
    const clipboard = new SelectionClipboard({
      adapter: makeAdapter({
        read: async() => [makeItem({ "image/png": new Blob(["png"]) })]
      }),
      decodeRaster: async() => {
        return {
          width: 2,
          height: 1,
          pixels: [
            { r: 1, g: 2, b: 3, a: 0 },
            { r: 5, g: 6, b: 7, a: 128 }
          ]
        };
      },
      createItem: makeItem
    });

    const result = await clipboard.read(8);

    assert.strictEqual(result.selection!.pixels[1].a, 128);
    assert.deepStrictEqual(result.selection!.mask, [false, true]);
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
      // What a premultiplying canvas would hand back for those pixels.
      decodeRaster: async() => {
        return {
          width: 2,
          height: 1,
          pixels: [
            { r: 170, g: 85, b: 85, a: 3 },
            { r: 5, g: 6, b: 7, a: 128 }
          ]
        };
      },
      createItem: makeItem
    });

    const result = await clipboard.read(8);

    assert.deepStrictEqual(result.selection!.pixels, exact);
  });

  test("rejects transparent and oversized external images", async() => {
    const transparent = new SelectionClipboard({
      adapter: makeAdapter({
        read: async() => [makeItem({ "image/png": new Blob(["png"]) })]
      }),
      decodeRaster: async() => {
        return {
          width: 1,
          height: 1,
          pixels: [{ r: 1, g: 2, b: 3, a: 0 }]
        };
      },
      createItem: makeItem
    });
    const oversized = new SelectionClipboard({
      adapter: makeAdapter({
        read: async() => [makeItem({ "image/png": new Blob(["png"]) })]
      }),
      decodeRaster: async() => {
        return {
          width: 9,
          height: 1,
          pixels: []
        };
      },
      createItem: makeItem
    });

    assert.strictEqual(
      (await transparent.read(8)).result.code,
      "image-empty"
    );
    assert.strictEqual(
      (await oversized.read(8)).result.code,
      "image-too-large"
    );
  });

  test("masked-out cells are transparent in the encoded PNG", async() => {
    const blob = await encodeSelectionPng(kSnapshot);
    const { data } = await decodePng(
      new Uint8Array(await blob.arrayBuffer())
    );

    assert.deepStrictEqual(
      [...data],
      [1, 2, 3, 4, 5, 6, 7, 0]
    );
  });
});
