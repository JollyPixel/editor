// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CatalogRejectedError } from "#src/client/index.ts";
import { archiveProject } from "../helpers/archive.ts";
import { text } from "../helpers/bytes.ts";
import { connectCatalog } from "../helpers/catalog.ts";

// CONSTANTS
const kViewerRights = {
  defaultRole: "viewer",
  rights: {
    viewer: {
      "asset-catalog.$join": "write",
      "*": "read"
    }
  }
} as const;

describe("catalog read command", () => {
  test("a read-only member reads the live content", async() => {
    await using project = await archiveProject();
    const texture = await project.link("texture.link");
    const map = await project.link("map.link");
    await project.editLive(map, texture);
    await using viewer = await connectCatalog(project.backend, kViewerRights);

    assert.strictEqual(text(await viewer.catalog.read(map)), texture);
  });

  test("rejects an unknown asset", async() => {
    await using project = await archiveProject();
    await using connection = await connectCatalog(project.backend);

    await assert.rejects(
      connection.catalog.read("missing"),
      CatalogRejectedError
    );
  });
});
