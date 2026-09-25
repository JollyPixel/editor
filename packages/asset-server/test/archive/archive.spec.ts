// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  unzipSync,
  zipSync
} from "fflate";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_MANIFEST_PATH,
  ASSET_CREATED,
  AssetArchiveError,
  UnknownAssetKindError,
  exportAssetArchive,
  importAssetArchive,
  planAssetImport,
  readAssetArchive,
  type AssetArchive
} from "#src/index.ts";
import {
  ARCHIVE_ACTOR,
  archiveWorkspace,
  zipArchive,
  type ArchiveWorkspace
} from "../helpers/archive.ts";
import {
  LINK_TARGETS_SET,
  linkContent,
  linkReference
} from "../helpers/kinds.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

async function exported(
  workspace: ArchiveWorkspace,
  root?: string
): Promise<AssetArchive> {
  return readAssetArchive(
    await exportAssetArchive(workspace.backend, { root })
  ).unwrap();
}

async function editLive(
  workspace: ArchiveWorkspace,
  assetId: string,
  ...targets: string[]
): Promise<void> {
  await workspace.backend.flush(assetId);
  await workspace.backend.internals.states.acquire(assetId, "link");
  workspace.eventStore.writer.append({
    assetType: "link",
    assetId,
    eventType: LINK_TARGETS_SET,
    eventData: { action: "set", targets },
    actor: ARCHIVE_ACTOR
  }).unwrap();
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

function rejection(
  bytesOrError: Uint8Array
): string {
  const result = readAssetArchive(bytesOrError);
  assert.strictEqual(result.ok, false);
  assert.ok(result.val instanceof AssetArchiveError);

  return result.val.rejection;
}

describe("exportAssetArchive", () => {
  test("round trip keeps ids, kinds and bytes, dependencies first", async() => {
    await using workspace = await archiveWorkspace();
    const texture = await workspace.link("textures/block.link");
    const map = await workspace.link("maps/overworld.link", texture);
    await workspace.link("unrelated.link");

    const archive = await exported(workspace, map);

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
    await using workspace = await archiveWorkspace();
    const map = await workspace.link("map.link");

    const names = Object.keys(unzipSync(
      await exportAssetArchive(workspace.backend, { root: map })
    ));

    assert.deepEqual(
      names.sort(),
      [ASSET_ARCHIVE_MANIFEST_PATH, "map.link"]
    );
  });

  test("includes a dependency added since the last snapshot", async() => {
    await using workspace = await archiveWorkspace();
    const texture = await workspace.link("texture.link");
    const map = await workspace.link("map.link");
    await editLive(workspace, map, texture);

    const archive = await exported(workspace, map);

    assert.deepEqual(
      archive.assets.map((asset) => asset.id),
      [texture, map]
    );
  });

  test("includes unflushed edits of a dependency", async() => {
    await using workspace = await archiveWorkspace();
    const texture = await workspace.link("texture.link");
    const map = await workspace.link("map.link", texture);
    await editLive(workspace, texture, "pixels");

    const archive = await exported(workspace, map);

    assert.strictEqual(text(archive.assets[0].data), "pixels");
    assert.deepEqual(archive.missing, [linkReference("pixels")]);
  });

  test("lists a deleted dependency as missing", async() => {
    await using workspace = await archiveWorkspace();
    const texture = await workspace.link("texture.link");
    const map = await workspace.link("map.link", texture);
    await workspace.backend.writer.remove({
      assetId: texture,
      actor: ARCHIVE_ACTOR
    });

    const archive = await exported(workspace, map);

    assert.deepEqual(archive.assets.map((asset) => asset.id), [map]);
    assert.deepEqual(archive.missing, [linkReference(texture)]);
  });

  test("without a root exports the whole workspace", async() => {
    await using workspace = await archiveWorkspace();
    const a = await workspace.link("a.link");
    const b = await workspace.link("b.link");

    const archive = await exported(workspace);

    assert.strictEqual(archive.root, undefined);
    assert.deepEqual(
      archive.assets.map((asset) => asset.id).sort(),
      [a, b].sort()
    );
  });

  test("rejects an unknown root", async() => {
    await using workspace = await archiveWorkspace();

    await assert.rejects(
      exportAssetArchive(workspace.backend, { root: "ghost" }),
      AssetArchiveError
    );
  });
});

describe("readAssetArchive", () => {
  const entry = {
    id: "a",
    kind: "link",
    path: "a.link"
  };

  test("rejects bytes that are not a ZIP", () => {
    assert.strictEqual(rejection(bytes("not a zip")), "corrupt");
  });

  test("rejects an archive without a manifest", () => {
    assert.strictEqual(
      rejection(zipSync({ "a.link": linkContent() })),
      "manifest-missing"
    );
  });

  test("rejects a manifest of another shape or version", () => {
    assert.strictEqual(
      rejection(zipArchive({ assets: "none" }, {})),
      "manifest-invalid"
    );
    assert.strictEqual(
      rejection(zipArchive({ version: 2, assets: [] }, {})),
      "unsupported-version"
    );
  });

  test("rejects a traversal path", () => {
    const manifest = {
      version: 1,
      assets: [{ ...entry, path: "../a.link" }]
    };

    assert.strictEqual(
      rejection(zipArchive(manifest, { "../a.link": linkContent() })),
      "unsafe-path"
    );
  });

  test("rejects a Windows reserved segment", () => {
    const manifest = {
      version: 1,
      assets: [{ ...entry, path: "a.link:stream" }]
    };

    assert.strictEqual(
      rejection(zipArchive(manifest, { "a.link:stream": linkContent() })),
      "unsafe-path"
    );
  });

  test("rejects a state path, listed or not", () => {
    const listed = {
      version: 1,
      assets: [{ ...entry, path: ".jollypixel/assets.json" }]
    };

    assert.strictEqual(
      rejection(zipArchive(listed, {})),
      "reserved-path"
    );
    assert.strictEqual(
      rejection(zipArchive(
        { version: 1, assets: [] },
        { ".jollypixel/state.json": bytes("{}") }
      )),
      "reserved-path"
    );
  });

  test("rejects a listed asset without an entry", () => {
    assert.strictEqual(
      rejection(zipArchive({ version: 1, assets: [entry] }, {})),
      "missing-entry"
    );
  });

  test("rejects a file absent from the manifest", () => {
    assert.strictEqual(
      rejection(zipArchive(
        { version: 1, assets: [] },
        { "stowaway.link": linkContent() }
      )),
      "unexpected-entry"
    );
  });

  test("rejects an asset listed twice and a root outside the archive", () => {
    assert.strictEqual(
      rejection(zipArchive(
        { version: 1, assets: [entry, entry] },
        { "a.link": linkContent() }
      )),
      "duplicate"
    );
    assert.strictEqual(
      rejection(zipArchive(
        { version: 1, root: linkReference("b"), assets: [entry] },
        { "a.link": linkContent() }
      )),
      "manifest-invalid"
    );
  });

  test("enforces the entry and archive size caps", () => {
    const archive = zipArchive(
      { version: 1, assets: [entry] },
      { "a.link": bytes("0123456789") }
    );

    const entryCap = readAssetArchive(archive, { maxEntryBytes: 4 });
    const archiveCap = readAssetArchive(archive, { maxBytes: 12 });

    assert.strictEqual(entryCap.ok, false);
    assert.strictEqual(archiveCap.ok, false);
    assert.strictEqual(readAssetArchive(archive).ok, true);
  });

  test("ignores what an operating system adds when re-zipping", () => {
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [entry] },
      {
        "a.link": linkContent(),
        "__MACOSX/._a.link": bytes("fork"),
        "maps/": new Uint8Array(),
        ".DS_Store": bytes("finder")
      }
    )).unwrap();

    assert.deepEqual(archive.assets.map((asset) => asset.path), ["a.link"]);
  });
});

describe("planAssetImport", () => {
  test("partitions live and fresh ids", async() => {
    await using origin = await archiveWorkspace();
    const texture = await origin.link("texture.link");
    const map = await origin.link("map.link", texture);
    const archive = await exported(origin, map);

    await using target = await archiveWorkspace();
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
    await using workspace = await archiveWorkspace();
    const texture = await workspace.link("texture.link");
    const map = await workspace.link("map.link", texture);
    const other = await workspace.link("other.link", texture);
    const archive = await exported(workspace, map);

    const plan = planAssetImport(workspace.backend, archive).unwrap();

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
    await using workspace = await archiveWorkspace();
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [{ id: "a", kind: "hologram", path: "a.holo" }] },
      { "a.holo": bytes("x") }
    )).unwrap();

    const plan = planAssetImport(workspace.backend, archive);

    assert.ok(plan.val instanceof UnknownAssetKindError);
  });

  test("names the asset whose document is corrupt", async() => {
    await using workspace = await archiveWorkspace();
    const archive = readAssetArchive(zipArchive(
      { version: 1, assets: [{ id: "a", kind: "link", path: "a.link" }] },
      { "a.link": linkContent("!") }
    )).unwrap();

    const plan = planAssetImport(workspace.backend, archive);

    assert.ok(plan.val instanceof AssetArchiveError);
    assert.strictEqual(plan.val.rejection, "unreadable-asset");
    assert.strictEqual(plan.val.assetId, "a");
  });

  test("reports a live id of another kind", async() => {
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

    const plan = planAssetImport(workspace.backend, archive);

    assert.strictEqual(plan.ok, true);
    assert.deepEqual(plan.unwrap().incompatible, [
      { id: "a", kind: "binary", path: "a.png" }
    ]);
  });
});

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
      workspace.backend.catalog.dependencies.dependenciesOf(copiedMap.id),
      [linkReference(copiedTexture.id)]
    );
    assert.deepEqual(
      workspace.backend.catalog.dependencies.dependenciesOf(map),
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
      target.backend.catalog.dependencies.dependenciesOf(map),
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
        target.backend.catalog.dependencies.dependenciesOf(map)[0].id
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

describe("importAssetArchive — storage", () => {
  test("reports once the imported content reached the source", async() => {
    await using origin = await archiveWorkspace();
    const map = await origin.link("map.link", "one");
    const archive = await exported(origin, map);

    await using target = await archiveWorkspace();
    (await importAssetArchive(target.backend, archive, {
      onConflict: "keep",
      actor: ARCHIVE_ACTOR
    })).unwrap();

    assert.strictEqual(text(await target.source.read("map.link")), "one");
    assert.strictEqual(target.backend.internals.projector.pending, 0);
  });
});
