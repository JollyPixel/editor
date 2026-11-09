// Import Node.js Dependencies
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  type Plugin,
  type Rolldown
} from "vite";
import {
  createProjectContributionsPlugin,
  findProjectContributions
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { StudioProject } from "../../server/project/StudioProject.ts";

// CONSTANTS
const kStudioRoot = path.join(import.meta.dirname, "..", "..");
const kEntry = "\0runtime-contributions-entry";
const kEditorOnly = new RegExp([
  /[\\/]packages[\\/](editors[\\/]host|asset-server|event-store)[\\/]/.source,
  /[\\/]packages[\\/]network[\\/]dist[\\/](?!protocol[\\/])/.source
].join("|"));

function runtimeEntry(): Plugin {
  return {
    name: "runtime-contributions-entry",
    resolveId: (source) => (source === kEntry ? kEntry : null),
    load: (id) => (
      id === kEntry ?
        "export { default } from \"virtual:jolly-pixel/contributions/runtime\";" :
        null
    )
  };
}

describe("runtime contributions bundle", () => {
  let packages: string[];
  let moduleIds: string[];

  before(async() => {
    const project = await StudioProject.open(
      StudioProject.resolveRoot(kStudioRoot)
    );
    const editors = Array.from(project.editors, (editor) => editor.package);
    packages = findProjectContributions(
      [
        ...editors,
        ...project.kinds.packages.map((kind) => kind.name)
      ],
      project.kinds.resolver,
      "runtime"
    ).map(({ manifest }) => path.dirname(manifest));

    const result = await build({
      configFile: false,
      logLevel: "silent",
      root: kStudioRoot,
      plugins: [
        runtimeEntry(),
        createProjectContributionsPlugin(project.kinds, editors)
      ],
      build: {
        write: false,
        minify: false,
        rolldownOptions: {
          input: kEntry,
          preserveEntrySignatures: "strict"
        }
      }
    }) as Rolldown.RolldownOutput;
    moduleIds = result.output.flatMap(
      (file) => (file.type === "chunk" ? file.moduleIds : [])
    );
  });

  test("bundles a runtime entry from every contributing package", () => {
    assert.notEqual(packages.length, 0);
    for (const directory of packages) {
      const runtimes = ["src", "dist"].map(
        (root) => path.join(directory, root, "runtime")
      );
      assert.ok(
        moduleIds.some((id) => runtimes.some(
          (runtime) => path.normalize(id).startsWith(runtime)
        )),
        `${directory} contributes no runtime module`
      );
    }
  });

  test("keeps editor and server code out of the runtime entries", () => {
    assert.deepStrictEqual(
      moduleIds.filter((id) => kEditorOnly.test(id)),
      []
    );
  });
});
