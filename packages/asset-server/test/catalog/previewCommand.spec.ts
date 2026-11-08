// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  AssetKindHandler,
  AssetPreview
} from "#src/index.ts";
import { CatalogRejectedError } from "#src/catalog/client/index.ts";
import { archiveProject } from "../helpers/archive.ts";
import { text } from "../helpers/bytes.ts";
import { connectCatalog } from "../helpers/catalog.ts";
import {
  linkContent,
  liveLinkHandler,
  type LinkCommand,
  type LinkState
} from "../helpers/kinds.ts";

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

interface PreviewedLinks {
  readonly handler: AssetKindHandler<LinkState, LinkCommand>;
  draws: number;
}

function previewedLinks(): PreviewedLinks {
  const links: PreviewedLinks = {
    handler: {
      ...liveLinkHandler(),
      preview(state): Promise<AssetPreview> {
        links.draws++;

        return Promise.resolve({
          type: "text/plain",
          bytes: linkContent(...state.targets)
        });
      }
    },
    draws: 0
  };

  return links;
}

function previewText(
  preview: AssetPreview | null
): string | null {
  return preview === null ? null : text(preview.bytes);
}

describe("catalog preview command", () => {
  test("a read-only member previews the stored content of a closed asset", async() => {
    const links = previewedLinks();
    await using project = await archiveProject({ handlers: [links.handler] });
    const map = await project.link("map.link", "grass");
    await using viewer = await connectCatalog(project.backend, kViewerRights);

    const preview = await viewer.catalog.preview(map);

    assert.strictEqual(preview?.type, "text/plain");
    assert.strictEqual(previewText(preview), "grass");
  });

  test("previews the live state of an open asset before it is saved", async() => {
    const links = previewedLinks();
    await using project = await archiveProject({ handlers: [links.handler] });
    const map = await project.link("map.link", "grass");
    await project.editLive(map, "stone");
    await using connection = await connectCatalog(project.backend);

    assert.strictEqual(previewText(await connection.catalog.preview(map)), "stone");
  });

  test("draws once per revision for every client", async() => {
    const links = previewedLinks();
    await using project = await archiveProject({ handlers: [links.handler] });
    const map = await project.link("map.link", "grass");
    await using connection = await connectCatalog(project.backend);
    const other = await connection.join();

    const previews = await Promise.all([
      connection.catalog.preview(map),
      other.preview(map)
    ]);
    await other.preview(map);

    assert.deepStrictEqual(previews.map(previewText), ["grass", "grass"]);
    assert.strictEqual(links.draws, 1);

    await project.editLive(map, "stone");
    await project.backend.flush(map);

    assert.strictEqual(previewText(await other.preview(map)), "stone");
    assert.strictEqual(links.draws, 2);
  });

  test("returns null for a kind without a preview hook", async() => {
    await using project = await archiveProject();
    const map = await project.link("map.link", "grass");
    await using connection = await connectCatalog(project.backend);

    assert.strictEqual(await connection.catalog.preview(map), null);
  });

  test("rejects an unknown asset", async() => {
    await using project = await archiveProject();
    await using connection = await connectCatalog(project.backend);

    await assert.rejects(
      connection.catalog.preview("missing"),
      CatalogRejectedError
    );
  });
});
