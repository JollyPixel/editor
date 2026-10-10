// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";

// Import Internal Dependencies
import {
  archiveConsole,
  type ArchiveConsoleContext
} from "#src/console/namespaces/archive.ts";

type ArchiveFlow = "download" | "pickAndImport" | "reset";

function registerArchives(
  enabled: boolean
) {
  const commands = new CommandConsole();
  const runs: ArchiveFlow[] = [];
  const archives: ArchiveConsoleContext["archives"] = {
    canImport: enabled,
    canReset: enabled,
    download: async() => {
      runs.push("download");
    },
    pickAndImport: async() => {
      runs.push("pickAndImport");
    },
    reset: async() => {
      runs.push("reset");
    }
  };
  archiveConsole(commands, { archives });

  return {
    commands,
    runs
  };
}

describe("archive console", () => {
  test("each command runs its archive flow", async() => {
    const { commands, runs } = registerArchives(true);

    await commands.submit("/archive.export");
    await commands.submit("/archive.import");
    await commands.submit("/archive.reset");

    assert.deepEqual(runs, ["download", "pickAndImport", "reset"]);
  });

  test("offers no import or reset when the archive disables them", async() => {
    const { commands, runs } = registerArchives(false);

    await commands.submit("/archive.import");
    assert.match(
      commands.scrollback.at(-1)?.text ?? "",
      /Unknown command "\/archive\.import"/
    );

    await commands.submit("/archive.reset");
    assert.match(
      commands.scrollback.at(-1)?.text ?? "",
      /Unknown command "\/archive\.reset"/
    );
    assert.deepEqual(runs, []);
  });
});
