// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CONTENT_TICKET_HEADER,
  ContentRefs,
  contentRefUrl,
  type ContentRef
} from "#src/index.ts";
import {
  LARGE_CONTENT,
  blobRoom,
  contentServer,
  lastSnapshot
} from "../helpers/live/contentRefs.ts";

describe("createContentHandler", () => {
  test("the content route serves immutable bytes only to the ticket of the open room", async() => {
    const refs = new ContentRefs();
    await using server = await contentServer(refs);
    await using harness = await blobRoom(LARGE_CONTENT, { contentRefs: refs });
    await harness.join("A");
    const { hash, ticket } = lastSnapshot(harness, "A") as ContentRef;
    const url = new URL(contentRefUrl(hash), server.origin);

    const served = await fetch(url, {
      headers: {
        [CONTENT_TICKET_HEADER]: ticket
      }
    });
    const forged = await fetch(url, {
      headers: {
        [CONTENT_TICKET_HEADER]: "forged"
      }
    });
    const anonymous = await fetch(url);

    assert.equal(served.status, 200);
    assert.equal(
      served.headers.get("cache-control"),
      "private, max-age=31536000, immutable"
    );
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), LARGE_CONTENT);
    assert.equal(forged.status, 404);
    assert.equal(anonymous.status, 404);
  });

  const encodings = [
    {
      title: "brotli when the request accepts it",
      compression: true,
      compress: true,
      accept: "gzip, br",
      encoding: "br"
    },
    {
      title: "gzip when the request refuses brotli",
      compression: true,
      compress: true,
      accept: "br;q=0, gzip",
      encoding: "gzip"
    },
    {
      title: "raw bytes when the request accepts no encoding",
      compression: true,
      compress: true,
      accept: "identity",
      encoding: null
    },
    {
      title: "raw bytes when the route does not compress",
      compression: false,
      compress: true,
      accept: "gzip, br",
      encoding: null
    },
    {
      title: "raw bytes when the kind does not compress",
      compression: true,
      compress: false,
      accept: "gzip, br",
      encoding: null
    }
  ];
  for (const { title, compression, compress, accept, encoding } of encodings) {
    test(`the content route sends ${title}`, async() => {
      const refs = new ContentRefs();
      await using server = await contentServer(refs, compression);
      await using harness = await blobRoom(LARGE_CONTENT, {
        contentRefs: refs,
        compress
      });
      await harness.join("A");
      const { hash, ticket } = lastSnapshot(harness, "A") as ContentRef;

      const served = await fetch(new URL(contentRefUrl(hash), server.origin), {
        headers: {
          [CONTENT_TICKET_HEADER]: ticket,
          "accept-encoding": accept
        }
      });

      assert.equal(served.headers.get("content-encoding"), encoding);
      assert.deepEqual(new Uint8Array(await served.arrayBuffer()), LARGE_CONTENT);
    });
  }
});
