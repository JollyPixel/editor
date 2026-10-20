// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { unzipSync } from "fflate";

// Import Internal Dependencies
import {
  AssetArchiveError,
  UnknownAssetError,
  exportAssetArchive,
  readAssetArchive,
  type AssetArchive
} from "#src/index.ts";
import {
  ARCHIVE_ACTOR,
  archiveProject,
  type ArchiveProject
} from "../helpers/archive.ts";
import { linkContent, linkReference } from "../helpers/kinds.ts";
import { text } from "../helpers/bytes.ts";

async function exported(
  project: ArchiveProject,
  root?: string
): Promise<AssetArchive> {
  return readAssetArchive(
    (await exportAssetArchive(project.backend, { root })).unwrap()
  ).unwrap();
}

async function editLive(
  project: ArchiveProject,
  assetId: string,
  ...targets: string[]
): Promise<void> {
  await project.backend.flush(assetId);
  await project.editLive(assetId, ...targets);
}

describe("exportAssetArchive", () => {
  test("round trip keeps ids, kinds and bytes, dependencies first", async() => {
    await using project = await archiveProject();
    const texture = await project.link("textures/block.link");
    const map = await project.link("maps/overworld.link", texture);
    await project.link("unrelated.link");

    const archive = await exported(project, map);

    assert.deepEqual(archive.root, { id: map, kind: "link" });
    assert.deepEqual(
      archive.assets.map(({ id, kind, path }) => [id, kind, path]),
      [
        [texture, "link", "textures/block.link"],
        [map, "link", "maps/overworld.link"]
      ]
    );
    assert.strictEqual(text(archive.assets[1].data), texture);
    assert.deepEqual(archive.missing, []);
  });

  test("never writes a state entry", async() => {
    await using project = await archiveProject();
    const map = await project.link("map.link");

    const names = Object.keys(unzipSync(
      (await exportAssetArchive(project.backend, { root: map })).unwrap()
    ));

    assert.deepEqual(
      names.sort(),
      ["bundle.json", "map.link"]
    );
  });

  test("includes a dependency added since the last snapshot", async() => {
    await using project = await archiveProject();
    const texture = await project.link("texture.link");
    const map = await project.link("map.link");
    await editLive(project, map, texture);

    const archive = await exported(project, map);

    assert.deepEqual(
      archive.assets.map((asset) => asset.id),
      [texture, map]
    );
  });

  test("includes unflushed edits of a dependency", async() => {
    await using project = await archiveProject();
    const texture = await project.link("texture.link");
    const map = await project.link("map.link", texture);
    await editLive(project, texture, "pixels");

    const archive = await exported(project, map);

    assert.strictEqual(text(archive.assets[0].data), "pixels");
    assert.deepEqual(archive.missing, [linkReference("pixels")]);
  });

  test("lists a deleted dependency as missing", async() => {
    await using project = await archiveProject();
    const texture = await project.link("texture.link");
    const map = await project.link("map.link", texture);
    await project.backend.writer.remove({
      assetId: texture,
      actor: ARCHIVE_ACTOR
    });

    const archive = await exported(project, map);

    assert.deepEqual(archive.assets.map((asset) => asset.id), [map]);
    assert.deepEqual(archive.missing, [linkReference(texture)]);
  });

  test("without a root exports the whole project", async() => {
    await using project = await archiveProject();
    const a = await project.link("a.link");
    const b = await project.link("b.link");

    const archive = await exported(project);

    assert.strictEqual(archive.root, undefined);
    assert.deepEqual(
      archive.assets.map((asset) => asset.id).sort(),
      [a, b].sort()
    );
  });

  test("returns an unknown root as an error", async() => {
    await using project = await archiveProject();

    const exported = await exportAssetArchive(project.backend, {
      root: "ghost"
    });

    assert.ok(!exported.ok);
    assert.ok(exported.val instanceof UnknownAssetError);
    assert.strictEqual(exported.val.assetId, "ghost");
  });

  test("refuses a stored document that import would reject", async() => {
    await using project = await archiveProject();
    const map = await project.link("map.link");
    await project.source.write("map.link", linkContent("!"));

    const exported = await exportAssetArchive(project.backend, {
      root: map
    });

    assert.ok(!exported.ok);
    assert.ok(exported.val instanceof AssetArchiveError);
    assert.strictEqual(exported.val.rejection, "unreadable-asset");
    assert.strictEqual(exported.val.assetId, map);
  });
});
