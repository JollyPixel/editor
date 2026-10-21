// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { zipSync } from "fflate";

// Import Internal Dependencies
import { AssetArchiveError, readAssetArchive } from "#src/index.ts";
import { zipArchive } from "../../helpers/archive.ts";
import { linkContent, linkReference } from "../../helpers/kinds.ts";
import { bytes } from "../../helpers/bytes.ts";

function rejection(
  bytesOrError: Uint8Array
): string {
  const result = readAssetArchive(bytesOrError);
  assert.strictEqual(result.ok, false);
  assert.ok(result.val instanceof AssetArchiveError);

  return result.val.rejection;
}

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

  test("rejects a listed part without an entry", () => {
    assert.strictEqual(
      rejection(zipArchive(
        { version: 1, assets: [{ ...entry, parts: ["a"] }] },
        { "a.link": linkContent() }
      )),
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

    for (const limits of [{ maxEntryBytes: 4 }, { maxBytes: 12 }]) {
      const result = readAssetArchive(archive, limits);

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof AssetArchiveError);
      assert.strictEqual(result.val.rejection, "too-large");
    }
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
