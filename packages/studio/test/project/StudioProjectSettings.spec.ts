// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  KIND_FILTER_CHANGE,
  StudioProjectSettings
} from "../../src/project/StudioProjectSettings.ts";
import type { ProjectSettingsReply } from "../../shared/api/project.ts";
import { KindFilter } from "../../shared/KindFilter.ts";
import { ProjectRights } from "../../shared/ProjectRights.ts";

describe("StudioProjectSettings", () => {
  test("announces the kind filter only when a reply changes it", async() => {
    let reply: ProjectSettingsReply = {
      name: "project",
      editors: [],
      kinds: [],
      kindFilter: {
        hidden: []
      }
    };
    const project = new StudioProjectSettings(
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
        }
      },
      ProjectRights.NONE,
      KindFilter.NONE
    );
    let changes = 0;
    project.addEventListener(KIND_FILTER_CHANGE, () => changes++);

    await project.load();
    await project.replaceKindFilter(new KindFilter(["voxelmodel"]));
    await project.load();

    assert.strictEqual(changes, 1);
    assert.deepEqual(project.kindFilter.hidden, ["voxelmodel"]);
  });
});
