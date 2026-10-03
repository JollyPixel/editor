// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CATALOG_IMPORT,
  CATALOG_ROOM,
  readAssetArchive
} from "#src/index.ts";
import { CatalogRejectedError } from "#src/catalog/client/index.ts";
import { archiveWorkspace } from "../helpers/archive.ts";
import { text } from "../helpers/bytes.ts";
import { connectCatalog } from "../helpers/catalog.ts";

// CONSTANTS
const kTinyContentCap = 64;
const kTinyEntryCap = 4;

describe("catalog archive commands over loopback", () => {
  test("export, plan and import round trip between two workspaces", async() => {
    await using origin = await archiveWorkspace();
    const texture = await origin.link("texture.link");
    const map = await origin.link("map.link", texture);
    await using exporter = await connectCatalog(origin.backend);

    const archive = await exporter.catalog.exportArchive(map);
    assert.deepEqual(
      readAssetArchive(archive).unwrap().assets.map((asset) => asset.id),
      [texture, map]
    );

    await using target = await archiveWorkspace();
    await using importer = await connectCatalog(target.backend);

    const plan = await importer.catalog.planImport(archive);
    assert.deepEqual(plan.live, []);
    assert.deepEqual(plan.fresh.map((entry) => entry.id), [texture, map]);

    const report = await importer.catalog.importArchive(archive, {
      onConflict: "keep"
    });
    await target.backend.flush();

    assert.deepEqual(report.root, { id: map, kind: "link" });
    assert.deepEqual(report.created.map((entry) => entry.id), [texture, map]);
    assert.strictEqual(importer.catalog.record(map)?.source, "map.link");
    assert.strictEqual(text(await target.source.read("map.link")), texture);

    const again = await importer.catalog.planImport(archive);
    assert.deepEqual(again.live.map((entry) => entry.id), [texture, map]);
  });

  test("rejects an archive over the content cap, both ways", async() => {
    await using origin = await archiveWorkspace();
    const map = await origin.link("map.link");
    await using exporter = await connectCatalog(origin.backend);
    const archive = await exporter.catalog.exportArchive(map);

    await using capped = await archiveWorkspace({
      catalogMaxContentBytes: kTinyContentCap
    });
    const cappedMap = await capped.link("map.link");
    await using connection = await connectCatalog(capped.backend);

    await assert.rejects(
      connection.catalog.exportArchive(cappedMap),
      CatalogRejectedError
    );
    await assert.rejects(
      connection.catalog.importArchive(archive, { onConflict: "keep" }),
      CatalogRejectedError
    );
    assert.strictEqual(capped.backend.catalog.size, 1);
  });

  test("applies the configured archive limits to plan and import", async() => {
    await using origin = await archiveWorkspace();
    const map = await origin.link("map.link");
    await using exporter = await connectCatalog(origin.backend);
    const archive = await exporter.catalog.exportArchive(map);

    await using capped = await archiveWorkspace({
      catalogArchiveLimits: { maxEntryBytes: kTinyEntryCap }
    });
    await using connection = await connectCatalog(capped.backend);

    await assert.rejects(
      connection.catalog.planImport(archive),
      /exceeds 4 bytes/
    );
    await assert.rejects(
      connection.catalog.importArchive(archive, { onConflict: "keep" }),
      CatalogRejectedError
    );
    assert.strictEqual(capped.backend.catalog.size, 0);
  });

  test("rejects a corrupt archive with the reason", async() => {
    await using workspace = await archiveWorkspace();
    await using connection = await connectCatalog(workspace.backend);

    await assert.rejects(
      connection.catalog.planImport(new Uint8Array([1, 2, 3])),
      /not a readable ZIP/
    );
  });

  test("a role without the import right writes nothing", async() => {
    await using origin = await archiveWorkspace();
    const map = await origin.link("map.link");
    await using exporter = await connectCatalog(origin.backend);
    const archive = await exporter.catalog.exportArchive(map);

    await using target = await archiveWorkspace();
    await using connection = await connectCatalog(target.backend, {
      rights: {
        default: {
          [`${CATALOG_ROOM}.${CATALOG_IMPORT}`]: "read"
        }
      }
    });

    const plan = await connection.catalog.planImport(archive);
    void connection.catalog.importArchive(archive, { onConflict: "keep" })
      .catch(() => void 0);
    await connection.catalog.planImport(archive);

    assert.strictEqual(plan.fresh.length, 1);
    assert.strictEqual(target.backend.catalog.size, 0);
  });
});
