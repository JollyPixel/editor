// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  exportAssetArchive,
  importAssetArchive,
  readAssetArchive,
  type AssetArchive
} from "#src/index.ts";
import {
  ARCHIVE_ACTOR,
  archiveWorkspace,
  type ArchiveWorkspace
} from "../helpers/archive.ts";
import { text } from "../helpers/bytes.ts";

async function exported(
  workspace: ArchiveWorkspace,
  root?: string
): Promise<AssetArchive> {
  return readAssetArchive(
    (await exportAssetArchive(workspace.backend, { root })).unwrap()
  ).unwrap();
}

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
  });
});
