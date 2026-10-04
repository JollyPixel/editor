// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  type Rolldown
} from "vite";

// CONSTANTS
const kHostRoot = path.join(import.meta.dirname, "..", "..");
const kEntryId = "ui-entry";

describe("@jolly-pixel/editor.host/ui bundle", () => {
  test("keeps the element and icon registrations of a bare import", async() => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      root: kHostRoot,
      build: {
        write: false,
        minify: false,
        rolldownOptions: {
          input: kEntryId,
          plugins: [
            {
              name: "ui-entry",
              resolveId: (id) => (id === kEntryId ? id : null),
              load: (id) => (
                id === kEntryId ? "import \"@jolly-pixel/editor.host/ui\";" : null
              )
            }
          ]
        }
      }
    }) as Rolldown.RolldownOutput;
    const modules = result.output
      .flatMap((file) => (file.type === "chunk" ? file.moduleIds : []))
      .map((id) => path.basename(id))
      .sort();

    assert.deepStrictEqual(
      modules.filter((name) => /^(ArchiveActions|archiveIcons)\.js$/.test(name)),
      ["ArchiveActions.js", "archiveIcons.js"]
    );
  });
});
