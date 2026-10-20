// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetArchiveError,
  UnknownAssetKindError,
  exportAssetArchive,
  planAssetImport,
  readAssetArchive,
  type AssetArchive
} from "#src/index.ts";
import {
  ARCHIVE_ACTOR,
  archiveProject,
  zipArchive,
  type ArchiveProject
} from "../../helpers/archive.ts";
import { linkContent } from "../../helpers/kinds.ts";
import { bytes } from "../../helpers/bytes.ts";

async function exported(
  project: ArchiveProject,
  root?: string
): Promise<AssetArchive> {
  return readAssetArchive(
    (await exportAssetArchive(project.backend, { root })).unwrap()
  ).unwrap();
}

describe("planAssetImport", () => {
  test("partitions live and fresh ids", async() => {
    await using origin = await archiveProject();
    const texture = await origin.link("texture.link");
    const map = await origin.link("map.link", texture);
    const archive = await exported(origin, map);

    await using target = await archiveProject();
    await target.backend.writer.create({
      path: "renamed.link",
      data: linkContent(),
      assetId: texture,
      actor: ARCHIVE_ACTOR
    });

    const plan = planAssetImport(target.backend, archive).unwrap();

    assert.deepEqual(plan.root, { id: map, kind: "link" });
    assert.deepEqual(plan.live, [
      { id: texture, kind: "link", path: "renamed.link" }
    ]);
    assert.deepEqual(plan.fresh, [
      { id: map, kind: "link", path: "map.link" }
    ]);
    assert.deepEqual(plan.sharedDependents, []);
  });

  test("names a dependent outside the archive", async() => {
    await using project = await archiveProject();
    const texture = await project.link("texture.link");
    const map = await project.link("map.link", texture);
    const other = await project.link("other.link", texture);
    const archive = await exported(project, map);

    const plan = planAssetImport(project.backend, archive).unwrap();

    assert.deepEqual(plan.sharedDependents, [
      {
        id: texture,
        kind: "link",
        path: "texture.link",
        dependents: [{ id: other, kind: "link", path: "other.link" }]
      }
    ]);
  });

  test("rejects an unknown kind", async() => {
    await using project = await archiveProject();
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [{ id: "a", kind: "hologram", path: "a.holo" }] },
      { "a.holo": bytes("x") }
    )).unwrap();

    const plan = planAssetImport(project.backend, archive);

    assert.ok(plan.val instanceof UnknownAssetKindError);
  });

  test("names the asset whose document is corrupt", async() => {
    await using project = await archiveProject();
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [{ id: "a", kind: "link", path: "a.link" }] },
      { "a.link": linkContent("!") }
    )).unwrap();

    const plan = planAssetImport(project.backend, archive);

    assert.ok(plan.val instanceof AssetArchiveError);
    assert.strictEqual(plan.val.rejection, "unreadable-asset");
    assert.strictEqual(plan.val.assetId, "a");
  });

  test("reports a live id of another kind", async() => {
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

    const plan = planAssetImport(project.backend, archive);

    assert.strictEqual(plan.ok, true);
    assert.deepEqual(plan.unwrap().incompatible, [
      { id: "a", kind: "binary", path: "a.png" }
    ]);
  });
});
