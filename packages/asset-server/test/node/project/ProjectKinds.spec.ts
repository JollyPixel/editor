// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  PROJECT_FILE_PATH,
  TEXTURE_KIND
} from "#src/index.ts";
import {
  PackageResolver,
  ProjectFile,
  ProjectKinds
} from "#src/node.ts";
import {
  kindPackage,
  loadedKind,
  packageLoader
} from "../../helpers/kindPackages.ts";
import { writeKindPackage } from "../../helpers/packages.ts";
import { tempDirectory } from "../../helpers/tempDirectory.ts";

function projectFile(
  kinds: Record<string, Record<string, unknown>>
): ProjectFile {
  return new ProjectFile(path.resolve("project"), {
    version: 1,
    kinds
  });
}

describe("ProjectKinds", () => {
  test("loads the packages in declaration order", async() => {
    const kinds = await ProjectKinds.load(
      projectFile({
        "kind-b": {},
        "kind-a": {}
      }),
      {
        load: packageLoader({
          "kind-a": {
            ASSET_KINDS: kindPackage(["alpha"])
          },
          "kind-b": {
            ASSET_KINDS: kindPackage(["beta", "gamma"])
          }
        })
      }
    );

    assert.deepEqual(
      kinds.packages.map((kindPackage) => kindPackage.name),
      ["kind-b", "kind-a"]
    );
    assert.deepEqual(
      kinds.handlers().map((handler) => handler.kind),
      ["beta", "gamma", "alpha", TEXTURE_KIND]
    );
    assert.deepEqual(
      kinds.descriptors(),
      ["beta", "gamma", "alpha"].map((kind) => loadedKind(kind))
    );
  });

  test("resolves the packages from the project root", async() => {
    await using directory = await tempDirectory();
    await writeKindPackage(
      path.join(directory.root, "node_modules", "kind-a"),
      "kind-a"
    );
    const file = path.join(directory.root, PROJECT_FILE_PATH);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({
      version: 1,
      kinds: {
        "kind-a": {
          size: 4
        }
      }
    }));

    const kinds = await ProjectKinds.load(
      await ProjectFile.read(directory.root)
    );

    assert.deepEqual(kinds.packages[0].handlers, [
      {
        kind: "alpha",
        options: {
          size: 4
        }
      }
    ]);
  });

  test("loads local folders and packages from the resolver's fallbacks", async() => {
    await using directory = await tempDirectory();
    const project = path.join(directory.root, "project");
    const host = path.join(directory.root, "host");
    await writeKindPackage(
      path.join(project, "kinds", "local"),
      "local-kind",
      "alpha"
    );
    await writeKindPackage(
      path.join(host, "node_modules", "kind-b"),
      "kind-b",
      "beta"
    );

    const kinds = await ProjectKinds.load(
      new ProjectFile(project, {
        version: 1,
        kinds: {
          "./kinds/local": {},
          "kind-b": {}
        }
      }),
      {
        resolver: new PackageResolver(project, {
          fallbacks: [host]
        })
      }
    );

    assert.deepEqual(
      kinds.handlers().map((handler) => handler.kind),
      ["alpha", "beta", TEXTURE_KIND]
    );
  });

  test("names both packages of a kind claimed twice", async() => {
    await assert.rejects(
      ProjectKinds.load(
        projectFile({
          "kind-a": {},
          "kind-b": {}
        }),
        {
          load: packageLoader({
            "kind-a": {
              ASSET_KINDS: kindPackage(["alpha"])
            },
            "kind-b": {
              ASSET_KINDS: kindPackage(["beta", "alpha"])
            }
          })
        }
      ),
      {
        name: "TypeError",
        message: "Asset kind \"alpha\" is declared by both \"kind-a\" and \"kind-b\"."
      }
    );
  });

  test("rejects a package claiming a kind asset-server ships", async() => {
    await assert.rejects(
      ProjectKinds.load(
        projectFile({
          "kind-a": {}
        }),
        {
          load: packageLoader({
            "kind-a": {
              ASSET_KINDS: kindPackage(["texture"])
            }
          })
        }
      ),
      {
        name: "TypeError",
        message: "Asset kind \"texture\" is declared by both \"@jolly-pixel/asset-server\" and \"kind-a\"."
      }
    );
  });

  test("replace swaps a package for one with other options", async() => {
    const load = packageLoader({
      "kind-a": {
        ASSET_KINDS: kindPackage(["alpha"])
      },
      "kind-b": {
        ASSET_KINDS: kindPackage(["beta"])
      }
    });
    const kinds = await ProjectKinds.load(
      projectFile({ "kind-a": { size: 8 } }),
      { load }
    );
    const other = await ProjectKinds.load(
      projectFile({ "kind-b": {} }),
      { load }
    );
    const [current] = kinds.packages;
    const resized = current.withOptions({ size: 16 });

    kinds.replace(resized);

    assert.strictEqual(kinds.find("kind-a"), resized);
    assert.strictEqual(kinds.handlers()[0], resized.handlers[0]);
    assert.throws(() => kinds.replace(other.packages[0]), TypeError);
  });
});
