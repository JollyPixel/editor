// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  ContentRefs,
  type ContentRef
} from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";
import { sha256Hex } from "../helpers/hash.ts";
import {
  ROOM_ACTOR,
  type RoomHarness
} from "../helpers/live/roomHarness.ts";
import {
  LARGE_CONTENT,
  blobRoom,
  lastSnapshot
} from "../helpers/live/contentRefs.ts";

describe("content refs", () => {
  test("evicting the room stops serving its content", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const refs = new ContentRefs();
    await using harness = await blobRoom(LARGE_CONTENT, { contentRefs: refs });
    const room = new AssetRoom("blob", harness.assetId).toString();
    const connection = await harness.join("A");
    const { hash, ticket } = lastSnapshot(harness, "A") as ContentRef;

    await connection.receive({ room, kind: "leave" });
    t.mock.timers.tick(1_000);
    await harness.server.settled(room);

    assert.equal(refs.read(hash, ticket), null);
  });

  test("replaced content reaches present members as a ref while the previous ref still resolves", async() => {
    const refs = new ContentRefs();
    await using harness = await blobRoom(LARGE_CONTENT, { contentRefs: refs });
    await harness.join("A");
    const before = lastSnapshot(harness, "A") as ContentRef;
    const replacement = bytes("replaced content");

    await replace(harness, replacement);
    await harness.join("B");
    const after = lastSnapshot(harness, "A") as ContentRef;

    assert.equal(after.hash, sha256Hex(replacement));
    assert.deepEqual(lastSnapshot(harness, "B"), after);
    assert.deepEqual(refs.read(after.hash, after.ticket)?.bytes, replacement);
    assert.deepEqual(refs.read(before.hash, before.ticket)?.bytes, LARGE_CONTENT);
  });

  test("a ref two replacements old stops resolving", async() => {
    const refs = new ContentRefs();
    await using harness = await blobRoom(LARGE_CONTENT, { contentRefs: refs });
    await harness.join("A");
    const first = lastSnapshot(harness, "A") as ContentRef;

    await replace(harness, bytes("second content"));
    await harness.join("B");
    await replace(harness, bytes("third content"));
    await harness.join("C");

    assert.equal(refs.read(first.hash, first.ticket), null);
  });

  const inline = [
    {
      title: "content at or below refAbove",
      data: bytes("tiny"),
      refs: true
    },
    {
      title: "a backend without content refs",
      data: LARGE_CONTENT,
      refs: false
    }
  ];
  for (const { title, data, refs } of inline) {
    test(`${title} sends the bytes inline`, async() => {
      await using harness = await blobRoom(data, {
        contentRefs: refs ? new ContentRefs() : undefined
      });

      await harness.join("A");

      assert.deepEqual(lastSnapshot(harness, "A"), data);
    });
  }
});

async function replace(
  harness: RoomHarness,
  data: Uint8Array
): Promise<void> {
  (await harness.sync.writer.update({
    assetId: harness.assetId,
    data,
    actor: ROOM_ACTOR
  })).unwrap();
}
