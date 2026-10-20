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
  archiveProject,
  zipArchive,
  type ArchiveProject
} from "../../helpers/archive.ts";
import { linkContent, linkReference } from "../../helpers/kinds.ts";
import { bytes, text } from "../../helpers/bytes.ts";

async function exported(
  project: ArchiveProject,
  root?: string
): Promise<AssetArchive> {
  return readAssetArchive(
    (await exportAssetArchive(project.backend, { root })).unwrap()
  ).unwrap();
}

function createdCount(
  project: ArchiveProject,
  assetId: string
): number {
  return project.eventStore.reader
    .list(assetId)
    .filter((event) => event.eventType === ASSET_CREATED)
    .length;
}

describe("importAssetArchive", () => {
  test("keep and replace reject an existing id of another kind", async() => {
    await using project = await archiveProject();
    await project.backend.writer.create({
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
      const result = await importAssetArchive(project.backend, archive, {
        onConflict,
        actor: ARCHIVE_ACTOR
      });

      assert.ok(result.val instanceof AssetArchiveError);
      assert.strictEqual(result.val.rejection, "kind-mismatch");
      assert.strictEqual(result.val.assetId, "a");
    }
    assert.strictEqual(project.backend.catalog.size, 1);
  });

  test("copy accepts an existing id of another kind", async() => {
    await using project = await archiveProject();
    await project.backend.writer.create({
      path: "a.png",
      data: bytes("png"),
      assetId: "a",
      actor: ARCHIVE_ACTOR
    });
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [{ id: "a", kind: "link", path: "a.link" }] },
      { "a.link": linkContent() }
    )).unwrap();

    const report = (await importAssetArchive(project.backend, archive, {
      onConflict: "copy",
      actor: ARCHIVE_ACTOR
    })).unwrap();

    assert.strictEqual(project.backend.catalog.record("a")?.kind, "binary");
    assert.strictEqual(report.created[0].kind, "link");
    assert.notStrictEqual(report.created[0].id, "a");
  });

  test("copy rejects a kind that cannot rebind internal references", async() => {
    await using project = await archiveProject();
    const target = await project.link("target.link");
    const map = await project.link("map.link", target);
    const archive = await exported(project, map);
    delete project.backend.kinds.get("link").rebind;

    const result = await importAssetArchive(project.backend, archive, {
      onConflict: "copy",
      actor: ARCHIVE_ACTOR
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(project.backend.catalog.size, 2);
  });

  test("copies the archive graph with new ids and leaves originals", async() => {
    await using project = await archiveProject();
    const texture = await project.link("texture.link");
    const map = await project.link("map.link", texture);
    const archive = await exported(project, map);

    const report = (await importAssetArchive(project.backend, archive, {
      onConflict: "copy",
      actor: ARCHIVE_ACTOR
    })).unwrap();
    const [copiedTexture, copiedMap] = report.created;

    assert.notStrictEqual(copiedTexture.id, texture);
    assert.notStrictEqual(copiedMap.id, map);
    assert.deepEqual(report.root, { id: copiedMap.id, kind: "link" });
    assert.deepEqual(
      project.backend.catalog.dependencies.listDependencies(copiedMap.id),
      [linkReference(copiedTexture.id)]
    );
    assert.deepEqual(
      project.backend.catalog.dependencies.listDependencies(map),
      [linkReference(texture)]
    );
    assert.strictEqual(
      text(await project.source.read(copiedMap.path)),
      copiedTexture.id
    );
    assert.deepEqual(report.failed, []);
  });

  test("creates every asset under its archived id", async() => {
    await using origin = await archiveProject();
    const texture = await origin.link("textures/block.link");
    const map = await origin.link("maps/overworld.link", texture);
    const archive = await exported(origin, map);

    await using target = await archiveProject();
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
    await using project = await archiveProject();
    const map = await project.link("map.link", "one");
    const archive = await exported(project, map);
    await project.backend.writer.update({
      assetId: map,
      data: linkContent("two"),
      actor: ARCHIVE_ACTOR
    });

    const report = (await importAssetArchive(project.backend, archive, {
      onConflict: "keep",
      actor: ARCHIVE_ACTOR
    })).unwrap();
    await project.backend.flush();

    assert.deepEqual(report.kept, [
      { id: map, kind: "link", path: "map.link" }
    ]);
    assert.deepEqual(report.created, []);
    assert.strictEqual(text(await project.source.read("map.link")), "two");
    assert.strictEqual(createdCount(project, map), 1);
  });

  test("replace rewrites live content at its current path", async() => {
    await using project = await archiveProject();
    const map = await project.link("map.link", "one");
    const archive = await exported(project, map);
    await project.backend.writer.update({
      assetId: map,
      data: linkContent("two"),
      actor: ARCHIVE_ACTOR
    });
    await project.backend.writer.rename({
      assetId: map,
      to: "moved.link",
      actor: ARCHIVE_ACTOR
    });

    const report = (await importAssetArchive(project.backend, archive, {
      onConflict: "replace",
      actor: ARCHIVE_ACTOR
    })).unwrap();
    await project.backend.flush();

    assert.deepEqual(report.replaced, [
      { id: map, kind: "link", path: "moved.link" }
    ]);
    assert.strictEqual(text(await project.source.read("moved.link")), "one");
    assert.strictEqual(await project.source.exists("map.link"), false);
    assert.strictEqual(createdCount(project, map), 1);
  });

  test("suffixes an occupied path and keeps the reference", async() => {
    await using origin = await archiveProject();
    const texture = await origin.link("texture.link");
    const map = await origin.link("map.link", texture);
    const archive = await exported(origin, map);

    await using target = await archiveProject();
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
    await using project = await archiveProject();
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

    const report = await importAssetArchive(project.backend, archive, {
      onConflict: "replace",
      actor: ARCHIVE_ACTOR
    });

    assert.strictEqual(report.ok, false);
    assert.strictEqual(project.backend.catalog.size, 0);
  });
});
