// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  AssetArchiveError,
  exportAssetArchive,
  importAssetArchive,
  readAssetArchive,
  type AssetArchive
} from "#src/index.ts";
import {
  ARCHIVE_ACTOR,
  archiveWorkspace,
  zipArchive,
  type ArchiveWorkspace
} from "../helpers/archive.ts";
import { linkContent, linkReference } from "../helpers/kinds.ts";
import { bytes, text } from "../helpers/bytes.ts";

async function exported(
  workspace: ArchiveWorkspace,
  root?: string
): Promise<AssetArchive> {
  return readAssetArchive(
    (await exportAssetArchive(workspace.backend, { root })).unwrap()
  ).unwrap();
}

function createdCount(
  workspace: ArchiveWorkspace,
  assetId: string
): number {
  return workspace.eventStore.reader
    .list(assetId)
    .filter((event) => event.eventType === ASSET_CREATED)
    .length;
}

describe("importAssetArchive", () => {
  test("keep and replace reject an existing id of another kind", async() => {
    await using workspace = await archiveWorkspace();
    await workspace.backend.writer.create({
      path: "a.png",
      data: bytes("png"),
      assetId: "a",
      actor: ARCHIVE_ACTOR
    });
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [{ id: "a", kind: "link", path: "a.link" }] },
      { "a.link": linkContent() }
    )).unwrap();

    for (const onConflict of ["keep", "replace"] as const) {
      const result = await importAssetArchive(workspace.backend, archive, {
        onConflict,
        actor: ARCHIVE_ACTOR
      });

      assert.ok(result.val instanceof AssetArchiveError);
      assert.strictEqual(result.val.rejection, "kind-mismatch");
      assert.strictEqual(result.val.assetId, "a");
    }
    assert.strictEqual(workspace.backend.catalog.size, 1);
  });

  test("copy accepts an existing id of another kind", async() => {
    await using workspace = await archiveWorkspace();
    await workspace.backend.writer.create({
      path: "a.png",
      data: bytes("png"),
      assetId: "a",
      actor: ARCHIVE_ACTOR
    });
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [{ id: "a", kind: "link", path: "a.link" }] },
      { "a.link": linkContent() }
    )).unwrap();

    const report = (await importAssetArchive(workspace.backend, archive, {
      onConflict: "copy",
      actor: ARCHIVE_ACTOR
    })).unwrap();

    assert.strictEqual(workspace.backend.catalog.record("a")?.kind, "binary");
    assert.strictEqual(report.created[0].kind, "link");
    assert.notStrictEqual(report.created[0].id, "a");
  });

  test("copy rejects a kind that cannot rebind internal references", async() => {
    await using workspace = await archiveWorkspace();
    const target = await workspace.link("target.link");
    const map = await workspace.link("map.link", target);
    const archive = await exported(workspace, map);
    delete workspace.backend.kinds.get("link").rebind;

    const result = await importAssetArchive(workspace.backend, archive, {
      onConflict: "copy",
      actor: ARCHIVE_ACTOR
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(workspace.backend.catalog.size, 2);
  });

  test("copies the archive graph with new ids and leaves originals", async() => {
    await using workspace = await archiveWorkspace();
    const texture = await workspace.link("texture.link");
    const map = await workspace.link("map.link", texture);
    const archive = await exported(workspace, map);

    const report = (await importAssetArchive(workspace.backend, archive, {
      onConflict: "copy",
      actor: ARCHIVE_ACTOR
    })).unwrap();
    const [copiedTexture, copiedMap] = report.created;

    assert.notStrictEqual(copiedTexture.id, texture);
    assert.notStrictEqual(copiedMap.id, map);
    assert.deepEqual(report.root, { id: copiedMap.id, kind: "link" });
    assert.deepEqual(
      workspace.backend.catalog.dependencies.listDependencies(copiedMap.id),
      [linkReference(copiedTexture.id)]
    );
    assert.deepEqual(
      workspace.backend.catalog.dependencies.listDependencies(map),
      [linkReference(texture)]
    );
    assert.strictEqual(
      text(await workspace.source.read(copiedMap.path)),
      copiedTexture.id
    );
    assert.deepEqual(report.failed, []);
  });

  test("creates every asset under its archived id", async() => {
    await using origin = await archiveWorkspace();
    const texture = await origin.link("textures/block.link");
    const map = await origin.link("maps/overworld.link", texture);
    const archive = await exported(origin, map);

    await using target = await archiveWorkspace();
    const report = (await importAssetArchive(target.backend, archive, {
      onConflict: "keep",
      actor: ARCHIVE_ACTOR
    })).unwrap();
    await target.backend.flush();

    assert.deepEqual(report.root, { id: map, kind: "link" });
    assert.deepEqual(report.created.map((entry) => entry.id), [texture, map]);
    assert.deepEqual(report.failed, []);
    assert.strictEqual(
      text(await target.source.read("maps/overworld.link")),
      texture
    );
    assert.deepEqual(
      target.backend.catalog.dependencies.listDependencies(map),
      [linkReference(texture)]
    );
  });

  test("keep leaves live assets alone, never creating them twice", async() => {
    await using workspace = await archiveWorkspace();
    const map = await workspace.link("map.link", "one");
    const archive = await exported(workspace, map);
    await workspace.backend.writer.update({
      assetId: map,
      data: linkContent("two"),
      actor: ARCHIVE_ACTOR
    });

    const report = (await importAssetArchive(workspace.backend, archive, {
      onConflict: "keep",
      actor: ARCHIVE_ACTOR
    })).unwrap();
    await workspace.backend.flush();

    assert.deepEqual(report.kept, [
      { id: map, kind: "link", path: "map.link" }
    ]);
    assert.deepEqual(report.created, []);
    assert.strictEqual(text(await workspace.source.read("map.link")), "two");
    assert.strictEqual(createdCount(workspace, map), 1);
  });

  test("replace rewrites live content at its current path", async() => {
    await using workspace = await archiveWorkspace();
    const map = await workspace.link("map.link", "one");
    const archive = await exported(workspace, map);
    await workspace.backend.writer.update({
      assetId: map,
      data: linkContent("two"),
      actor: ARCHIVE_ACTOR
    });
    await workspace.backend.writer.rename({
      assetId: map,
      to: "moved.link",
      actor: ARCHIVE_ACTOR
    });

    const report = (await importAssetArchive(workspace.backend, archive, {
      onConflict: "replace",
      actor: ARCHIVE_ACTOR
    })).unwrap();
    await workspace.backend.flush();

    assert.deepEqual(report.replaced, [
      { id: map, kind: "link", path: "moved.link" }
    ]);
    assert.strictEqual(text(await workspace.source.read("moved.link")), "one");
    assert.strictEqual(await workspace.source.exists("map.link"), false);
    assert.strictEqual(createdCount(workspace, map), 1);
  });

  test("suffixes an occupied path and keeps the reference", async() => {
    await using origin = await archiveWorkspace();
    const texture = await origin.link("texture.link");
    const map = await origin.link("map.link", texture);
    const archive = await exported(origin, map);

    await using target = await archiveWorkspace();
    const squatter = await target.link("texture.link");

    const report = (await importAssetArchive(target.backend, archive, {
      onConflict: "keep",
      actor: ARCHIVE_ACTOR
    })).unwrap();

    assert.deepEqual(report.created[0], {
      id: texture,
      kind: "link",
      path: "texture-2.link"
    });
    assert.strictEqual(
      target.backend.catalog.record(squatter)?.source,
      "texture.link"
    );
    assert.strictEqual(
      target.backend.catalog.record(
        target.backend.catalog.dependencies.listDependencies(map)[0].id
      )?.source,
      "texture-2.link"
    );
  });

  test("writes nothing when the pre-flight fails", async() => {
    await using workspace = await archiveWorkspace();
    const archive = readAssetArchive(zipArchive(
      {
        version: 1,
        assets: [
          { id: "good", kind: "link", path: "good.link" },
          { id: "bad", kind: "link", path: "bad.link" }
        ]
      },
      {
        "good.link": linkContent(),
        "bad.link": linkContent("!")
      }
    )).unwrap();

    const report = await importAssetArchive(workspace.backend, archive, {
      onConflict: "replace",
      actor: ARCHIVE_ACTOR
    });

    assert.strictEqual(report.ok, false);
    assert.strictEqual(workspace.backend.catalog.size, 0);
  });
});
