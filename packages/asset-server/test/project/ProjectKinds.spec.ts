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
  ProjectFile,
  ProjectKinds
} from "#src/node.ts";
import {
  kindDescriptor,
  kindPackage,
  packageLoader
} from "../helpers/kindPackages.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";

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
      ["beta", "gamma", "alpha"].map(kindDescriptor)
    );
  });

  test("resolves the packages from the project root", async() => {
    await using workspace = await tempWorkspace();
    const packageRoot = path.join(workspace.root, "node_modules", "kind-a");
    await fs.mkdir(packageRoot, { recursive: true });
    await fs.writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "kind-a",
        type: "module",
        exports: "./index.js"
      })
    );
    await fs.writeFile(
      path.join(packageRoot, "index.js"),
      "export const ASSET_KINDS = {\n" +
      "  descriptors: [],\n" +
      "  optionsSchema: { type: \"object\" },\n" +
      "  handlers: (options) => [{ kind: \"alpha\", options }]\n" +
      "};\n"
    );
    const file = path.join(workspace.root, PROJECT_FILE_PATH);
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
      await ProjectFile.read(workspace.root)
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
});
