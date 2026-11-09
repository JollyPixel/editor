// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GAME_CHANGE,
  KIND_FILTER_CHANGE,
  StudioProjectSettings
} from "../../src/project/StudioProjectSettings.ts";
import type { ProjectSettingsReply } from "../../shared/api/project.ts";
import { KindFilter } from "../../shared/KindFilter.ts";
import { ProjectRights } from "../../shared/ProjectRights.ts";

function settings(): StudioProjectSettings {
  let reply: ProjectSettingsReply = {
    name: "project",
    editors: [],
    kinds: [],
    kindFilter: {
      hidden: []
    },
    game: {
      start: null
    }
  };

  return new StudioProjectSettings(
    {
      read: async() => reply,
      replaceKinds: async() => reply,
      replaceAccess: async() => reply,
      replaceKindFilter: async(kindFilter) => {
        reply = {
          ...reply,
          kindFilter
        };

        return reply;
      },
      replaceGame: async(game) => {
        reply = {
          ...reply,
          game
        };

        return reply;
      }
    },
    ProjectRights.NONE,
    {
      kindFilter: {
        hidden: []
      },
      game: {
        start: null
      }
    }
  );
}

describe("StudioProjectSettings", () => {
  test("announces the kind filter only when a reply changes it", async() => {
    const project = settings();
    let changes = 0;
    project.addEventListener(KIND_FILTER_CHANGE, () => changes++);

    await project.load();
    await project.replaceKindFilter(new KindFilter(["voxelmodel"]));
    await project.load();

    assert.strictEqual(changes, 1);
    assert.deepEqual(project.kindFilter.hidden, ["voxelmodel"]);
  });

  test("announces the default scene only when a reply changes it", async() => {
    const project = settings();
    let changes = 0;
    project.addEventListener(GAME_CHANGE, () => changes++);

    await project.load();
    await project.replaceGame({ start: "arena" });
    await project.load();

    assert.strictEqual(changes, 1);
    assert.deepEqual(project.game, { start: "arena" });
  });
});
