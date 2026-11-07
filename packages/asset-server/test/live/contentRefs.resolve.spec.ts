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
import {
  ContentUnavailableError,
  resolveBinarySnapshot
} from "#src/catalog/client/index.ts";
import { sha256Hex } from "../helpers/hash.ts";
import { ROOM_ACTOR } from "../helpers/live/roomHarness.ts";
import {
  LARGE_CONTENT,
  blobRoom,
  contentServer,
  fetchFrom,
  joinOverLoopback
} from "../helpers/live/contentRefs.ts";

describe("resolveBinarySnapshot", () => {
  test("a joiner receives content above refAbove as a ref that resolveBinarySnapshot fetches", async(t) => {
    const refs = new ContentRefs();
    await using server = await contentServer(refs);
    await using harness = await blobRoom(LARGE_CONTENT, { contentRefs: refs });
    fetchFrom(t, server.origin);
    using joined = joinOverLoopback(harness);

    const ref = await joined.snapshot as ContentRef;

    assert.deepEqual(ref, {
      type: "ref",
      hash: sha256Hex(LARGE_CONTENT),
      size: LARGE_CONTENT.byteLength,
      ticket: ref.ticket
    });
    assert.deepEqual(await resolveBinarySnapshot(ref, joined.room), LARGE_CONTENT);
  });

  test("a room that never answers the inline snapshot request rejects the resolution", async(t) => {
    await using harness = await blobRoom(LARGE_CONTENT, { contentRefs: new ContentRefs() });
    using joined = joinOverLoopback(harness);
    const ref = await joined.snapshot;
    t.mock.method(globalThis, "fetch", () => Promise.reject(new TypeError("fetch failed")));
    t.mock.method(joined.room, "send", () => undefined);
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const resolving = resolveBinarySnapshot(ref, joined.room);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    t.mock.timers.tick(30_000);

    await assert.rejects(Promise.resolve(resolving), ContentUnavailableError);
  });

  const fallbacks = [
    {
      title: "its live room",
      tag: null
    },
    {
      title: "a read-only tag room",
      tag: "v1"
    }
  ];
  for (const { title, tag } of fallbacks) {
    test(`a ref the content route cannot serve resolves from the inline snapshot of ${title}`, async(t) => {
      await using server = await contentServer(new ContentRefs());
      await using harness = await blobRoom(LARGE_CONTENT, { contentRefs: new ContentRefs() });
      fetchFrom(t, server.origin);
      if (tag !== null) {
        (await harness.tags.create({
          assetId: harness.assetId,
          name: tag,
          actor: ROOM_ACTOR
        })).unwrap();
      }
      using joined = joinOverLoopback(
        harness,
        new AssetRoom("blob", harness.assetId, tag).toString()
      );

      const ref = await joined.snapshot;

      assert.equal((ref as ContentRef).type, "ref");
      assert.deepEqual(await resolveBinarySnapshot(ref, joined.room), LARGE_CONTENT);
    });
  }
});
