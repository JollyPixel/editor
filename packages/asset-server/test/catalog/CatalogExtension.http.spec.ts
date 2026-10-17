// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { CatalogProjection } from "#src/index.ts";
import { createCatalogHandler } from "#src/node.ts";
import { syncHarness } from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";
import { serveCatalog } from "../helpers/catalog.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("catalog HTTP handler", () => {
  test("returns the same bytes as the snapshot", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    projection.load();

    await using server = await serveCatalog(projection);
    const response = await fetch(`${server.origin}${CATALOG_URL_PATH}`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-type"),
      "application/json; charset=utf-8"
    );
    assert.deepEqual(await response.json(), projection.snapshot());
  });

  test("passes other paths to the next handler", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();

    let nexted = false;
    const handler = createCatalogHandler({ projection });
    handler(
      { url: "/index.html", method: "GET" } as never,
      {} as never,
      () => {
        nexted = true;
      }
    );

    assert.strictEqual(nexted, true);
  });

  test("ignores the query string when matching the path", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();

    await using server = await serveCatalog(projection);
    const response = await fetch(
      `${server.origin}${CATALOG_URL_PATH}?since=12`
    );

    assert.strictEqual(response.status, 200);
    assert.deepEqual(await response.json(), projection.snapshot());
  });

  test("answers 304 while the snapshot is unchanged", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();

    await using server = await serveCatalog(projection);
    const first = await fetch(`${server.origin}${CATALOG_URL_PATH}`);
    await first.arrayBuffer();
    const etag = first.headers.get("etag");

    assert.ok(etag !== null);
    assert.strictEqual(first.headers.get("cache-control"), "no-cache");

    const second = await fetch(`${server.origin}${CATALOG_URL_PATH}`, {
      headers: { "if-none-match": etag }
    });

    assert.strictEqual(second.status, 304);
  });

  test("serves the new snapshot once the catalog changes", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();
    projection.start();

    await using server = await serveCatalog(projection);
    const first = await fetch(`${server.origin}${CATALOG_URL_PATH}`);
    await first.arrayBuffer();
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    const second = await fetch(`${server.origin}${CATALOG_URL_PATH}`, {
      headers: { "if-none-match": first.headers.get("etag") ?? "" }
    });

    assert.strictEqual(second.status, 200);
    assert.deepEqual(await second.json(), projection.snapshot());
    assert.strictEqual(projection.size, 1);
  });

  test("refuses a non-GET method", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();

    await using server = await serveCatalog(projection);
    const response = await fetch(`${server.origin}${CATALOG_URL_PATH}`, {
      method: "POST"
    });

    assert.strictEqual(response.status, 405);
    assert.strictEqual(response.headers.get("allow"), "GET, HEAD");
  });
});
