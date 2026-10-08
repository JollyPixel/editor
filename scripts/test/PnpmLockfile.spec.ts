// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { PnpmLockfile } from "../ci/PnpmLockfile.ts";

// CONSTANTS
const kBase = `---
lockfileVersion: '9.0'

importers:

  .:
    packageManagerDependencies:
      pnpm:
        specifier: 12.4.2
        version: 12.4.2

---
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    devDependencies:
      typescript:
        specifier: ^6.0.3
        version: 6.0.3

  packages/arbor: {}

  packages/ui:
    dependencies:
      lit:
        specifier: 3.3.0
        version: 3.3.0

packages:

  lit@3.3.0:
    resolution: {integrity: sha512-lit330}

  typescript@6.0.3:
    resolution: {integrity: sha512-ts603}

snapshots:

  lit@3.3.0: {}

  typescript@6.0.3: {}
`;

function changed(
  next: string
): Set<string> | null {
  return PnpmLockfile.parse(next)
    .importersChangedSince(PnpmLockfile.parse(kBase));
}

describe("PnpmLockfile.importersChangedSince", () => {
  it("finds no importer when the lockfile is unchanged", () => {
    assert.deepEqual(changed(kBase), new Set());
  });

  it("ignores CRLF line endings", () => {
    assert.deepEqual(changed(kBase.replaceAll("\n", "\r\n")), new Set());
  });

  it("attributes a direct dependency bump to its importer", () => {
    const next = kBase
      .replaceAll("3.3.0", "3.4.0")
      .replace("sha512-lit330", "sha512-lit340");

    assert.deepEqual(changed(next), new Set(["packages/ui"]));
  });

  it("attributes a first dependency added to an empty importer", () => {
    const next = kBase.replace("  packages/arbor: {}", [
      "  packages/arbor:",
      "    dependencies:",
      "      lit:",
      "        specifier: 3.3.0",
      "        version: 3.3.0"
    ].join("\n"));

    assert.deepEqual(changed(next), new Set(["packages/arbor"]));
  });

  it("skips the importer of a removed workspace", () => {
    assert.deepEqual(changed(kBase.replace("  packages/arbor: {}\n", "")), new Set());
  });

  it("gives up when an existing snapshot changes", () => {
    const next = kBase
      .replace("  lit@3.3.0: {}", "  lit@3.3.0:\n    dependencies:\n      '@lit/reactive-element': 2.1.0");

    assert.equal(changed(next), null);
  });

  it("gives up when an existing package resolution changes", () => {
    assert.equal(changed(kBase.replace("sha512-ts603", "sha512-other")), null);
  });

  it("gives up when the root importer changes", () => {
    assert.equal(changed(kBase.replace("^6.0.3", "^6.1.0")), null);
  });

  it("gives up when the pnpm version changes", () => {
    assert.equal(changed(kBase.replaceAll("12.4.2", "12.5.0")), null);
  });

  it("gives up when settings change", () => {
    assert.equal(changed(kBase.replace("autoInstallPeers: true", "autoInstallPeers: false")), null);
  });

  it("gives up when the lockfile version changes", () => {
    const next = kBase.replace("'9.0'\n\nsettings", "'10.0'\n\nsettings");

    assert.equal(changed(next), null);
  });
});
