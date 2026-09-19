// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  binaryAssetKind,
  encodeContent,
  foldAssetEvent
} from "#src/index.ts";
import {
  bytes,
  text
} from "../../helpers/bytes.ts";
import { assetEvent } from "../../helpers/events.ts";

describe("binaryAssetKind", () => {
  test("starts from empty bytes", async() => {
    const state = binaryAssetKind.create("a1");

    assert.deepEqual(await binaryAssetKind.serialize(state), new Uint8Array());
  });

  test("applies created content", async() => {
    const state = binaryAssetKind.create("a1");

    foldAssetEvent(binaryAssetKind, state, assetEvent(ASSET_CREATED, {
      path: "a.png",
      kind: "binary",
      hash: "h1",
      size: 5,
      content: encodeContent(bytes("hello"))
    }));

    assert.strictEqual(
      text(await binaryAssetKind.serialize(state)),
      "hello"
    );
  });

  test("the last update wins", async() => {
    const state = binaryAssetKind.create("a1");

    foldAssetEvent(binaryAssetKind, state, assetEvent(ASSET_CREATED, {
      path: "a.png", kind: "binary", hash: "h1", size: 3,
      content: encodeContent(bytes("one"))
    }));
    foldAssetEvent(binaryAssetKind, state, assetEvent(ASSET_UPDATED, {
      path: "a.png", kind: "binary", hash: "h2", size: 3,
      content: encodeContent(bytes("two"))
    }));

    assert.strictEqual(
      text(await binaryAssetKind.serialize(state)),
      "two"
    );
  });

  test("a delete empties the state", async() => {
    const state = binaryAssetKind.create("a1");

    foldAssetEvent(binaryAssetKind, state, assetEvent(ASSET_CREATED, {
      path: "a.png", kind: "binary", hash: "h1", size: 3,
      content: encodeContent(bytes("one"))
    }));
    foldAssetEvent(binaryAssetKind, state, assetEvent(ASSET_DELETED, {
      path: "a.png",
      kind: "binary"
    }));

    assert.deepEqual(
      await binaryAssetKind.serialize(state),
      new Uint8Array()
    );
  });

  test("ignores domain events", async() => {
    const state = binaryAssetKind.create("a1");

    foldAssetEvent(binaryAssetKind, state, assetEvent(ASSET_CREATED, {
      path: "a.png", kind: "binary", hash: "h1", size: 3,
      content: encodeContent(bytes("one"))
    }));
    foldAssetEvent(
      binaryAssetKind,
      state,
      assetEvent("pixelart.stroke.applied", { x: 1 })
    );

    assert.strictEqual(
      text(await binaryAssetKind.serialize(state)),
      "one"
    );
  });
});

describe("content encoding", () => {
  test("round-trips arbitrary bytes", async() => {
    const source = new Uint8Array([0, 255, 128, 7, 42]);
    const state = binaryAssetKind.create("a1");

    foldAssetEvent(binaryAssetKind, state, assetEvent(ASSET_CREATED, {
      path: "a.bin", kind: "binary", hash: "h1", size: source.length,
      content: encodeContent(source)
    }));

    assert.deepEqual(await binaryAssetKind.serialize(state), source);
  });
});
