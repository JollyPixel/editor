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
} from "../helpers/packages.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";

describe("PackageResolver", () => {
  test("resolves a package name from the project's node_modules", async() => {
    await using workspace = await tempWorkspace();
    const project = path.join(workspace.root, "project");
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
    await using workspace = await tempWorkspace();
    const project = path.join(workspace.root, "project");
    const host = path.join(workspace.root, "host");
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
    await using workspace = await tempWorkspace();
    const project = path.join(workspace.root, "project");
    const host = path.join(workspace.root, "host");
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

  test("resolves a local folder against the project root", async() => {
    await using workspace = await tempWorkspace();
    const exported = await writeKindPackage(
      path.join(workspace.root, "kinds", "exported"),
      "exported-kind"
    );
    const main = await writePackage(
      path.join(workspace.root, "kinds", "main"),
      {
        main: "./entry.js"
      },
      {
        "entry.js": "export const value = 1;\n"
      }
    );
    const resolver = new PackageResolver(workspace.root);

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
    await using workspace = await tempWorkspace();
    const project = path.join(workspace.root, "project");
    const host = path.join(workspace.root, "host");
    await fs.mkdir(project);
    await writeKindPackage(path.join(host, "kinds", "local"), "local");
    const resolver = new PackageResolver(project, {
      fallbacks: [host]
    });

    assert.deepEqual(resolver.importersOf("./kinds/local"), [
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
    await using workspace = await tempWorkspace();
    const resolver = new PackageResolver(workspace.root);

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
