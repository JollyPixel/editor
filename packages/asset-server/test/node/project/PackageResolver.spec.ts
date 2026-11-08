// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import { PackageResolver } from "#src/node.ts";
import {
  writeKindPackage,
  writePackage
} from "../../helpers/packages.ts";
import { tempDirectory } from "../../helpers/tempDirectory.ts";

describe("PackageResolver", () => {
  test("resolves a package name from the project's node_modules", async() => {
    await using temporary = await tempDirectory();
    const project = path.join(temporary.root, "project");
    const directory = await writeKindPackage(
      path.join(project, "node_modules", "kind-a"),
      "kind-a"
    );
    const resolver = new PackageResolver(project);

    assert.strictEqual(resolver.locate("kind-a"), await fs.realpath(directory));
    assert.strictEqual(
      await fs.realpath(resolver.resolve("kind-a")),
      await fs.realpath(path.join(directory, "index.js"))
    );
  });

  test("falls back to the next directories for a package name", async() => {
    await using temporary = await tempDirectory();
    const project = path.join(temporary.root, "project");
    const host = path.join(temporary.root, "host");
    await fs.mkdir(project);
    const directory = await writeKindPackage(
      path.join(host, "node_modules", "kind-a"),
      "kind-a"
    );
    const resolver = new PackageResolver(project, {
      fallbacks: [host]
    });

    assert.deepEqual(resolver.directories, [project, host]);
    assert.strictEqual(resolver.locate("kind-a"), await fs.realpath(directory));
    assert.strictEqual(
      await fs.realpath(resolver.resolve("kind-a")),
      await fs.realpath(path.join(directory, "index.js"))
    );
  });

  test("prefers the project's copy of a package", async() => {
    await using temporary = await tempDirectory();
    const project = path.join(temporary.root, "project");
    const host = path.join(temporary.root, "host");
    const directory = await writeKindPackage(
      path.join(project, "node_modules", "kind-a"),
      "kind-a"
    );
    await writeKindPackage(path.join(host, "node_modules", "kind-a"), "kind-a");
    const resolver = new PackageResolver(project, {
      fallbacks: [host]
    });

    assert.strictEqual(resolver.locate("kind-a"), await fs.realpath(directory));
  });

  test("finds a package by name in a search folder", async() => {
    await using temporary = await tempDirectory();
    const project = path.join(temporary.root, "project");
    const folder = path.join(temporary.root, "packages");
    await fs.mkdir(project);
    await fs.mkdir(path.join(folder, "empty"), { recursive: true });
    await fs.writeFile(path.join(folder, "notes.txt"), "");
    const directory = await writeKindPackage(
      path.join(folder, "folder-name"),
      "@scope/kind-a"
    );
    const resolver = new PackageResolver(project, {
      searchFolders: [folder]
    });

    assert.strictEqual(
      resolver.locate("@scope/kind-a"),
      await fs.realpath(directory)
    );
    assert.strictEqual(
      await fs.realpath(resolver.resolve("@scope/kind-a")),
      await fs.realpath(path.join(directory, "index.js"))
    );
    assert.throws(
      () => resolver.locate("folder-name"),
      {
        name: "TypeError",
        message: "Cannot locate the package \"folder-name\"."
      }
    );
  });

  test("prefers an installed package over a search folder", async() => {
    await using temporary = await tempDirectory();
    const project = path.join(temporary.root, "project");
    const host = path.join(temporary.root, "host");
    const folder = path.join(temporary.root, "packages");
    await fs.mkdir(project);
    const installed = await writeKindPackage(
      path.join(host, "node_modules", "kind-a"),
      "kind-a"
    );
    await writeKindPackage(path.join(folder, "kind-a"), "kind-a");
    const resolver = new PackageResolver(project, {
      fallbacks: [host],
      searchFolders: [folder]
    });

    assert.strictEqual(resolver.locate("kind-a"), await fs.realpath(installed));
  });

  test("resolves a local folder against the project root", async() => {
    await using temporary = await tempDirectory();
    const exported = await writeKindPackage(
      path.join(temporary.root, "kinds", "exported"),
      "exported-kind"
    );
    const main = await writePackage(
      path.join(temporary.root, "kinds", "main"),
      {
        main: "./entry.js"
      },
      {
        "entry.js": "export const value = 1;\n"
      }
    );
    const resolver = new PackageResolver(temporary.root);

    assert.strictEqual(
      resolver.locate("./kinds/exported"),
      await fs.realpath(exported)
    );
    assert.strictEqual(
      await fs.realpath(resolver.resolve("./kinds/exported")),
      await fs.realpath(path.join(exported, "index.js"))
    );
    assert.strictEqual(
      await fs.realpath(resolver.resolve("./kinds/main")),
      await fs.realpath(path.join(main, "entry.js"))
    );
  });

  test("never resolves a local folder from a fallback", async() => {
    await using temporary = await tempDirectory();
    const project = path.join(temporary.root, "project");
    const host = path.join(temporary.root, "host");
    await fs.mkdir(project);
    await writeKindPackage(path.join(host, "kinds", "local"), "local");
    const resolver = new PackageResolver(project, {
      fallbacks: [host]
    });

    assert.deepEqual(resolver.findImporters("./kinds/local"), [
      path.join(project, "package.json")
    ]);
    assert.throws(
      () => resolver.locate("./kinds/local"),
      {
        name: "TypeError",
        message: `Cannot locate the package "./kinds/local" in "${project}".`
      }
    );
  });

  test("names a package it cannot find", async() => {
    await using temporary = await tempDirectory();
    const resolver = new PackageResolver(temporary.root);

    assert.throws(
      () => resolver.locate("missing-kind"),
      {
        name: "TypeError",
        message: "Cannot locate the package \"missing-kind\"."
      }
    );
    assert.throws(
      () => resolver.resolve("missing-kind"),
      {
        name: "TypeError",
        message: "Cannot resolve the package \"missing-kind\"."
      }
    );
  });

  test("tells local paths from package names", () => {
    assert.ok(PackageResolver.isLocal("./kinds/a"));
    assert.ok(PackageResolver.isLocal("../kinds/a"));
    assert.ok(PackageResolver.isLocal(".\\kinds\\a"));
    assert.ok(!PackageResolver.isLocal("kind-a"));
    assert.ok(!PackageResolver.isLocal("@scope/kind-a"));
    assert.ok(!PackageResolver.isLocal(".hidden"));
  });
});
