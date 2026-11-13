// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  DEFAULT_PROJECT_SECTIONS,
  type ProjectSettingsReply,
  type SettingsUpdate,
  KindFilter,
  ProjectRights,
  projectSectionsSchema
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { ApiRequestError } from "../../src/api/errors/ApiRequestError.ts";
import {
  GAME_CHANGE,
  KIND_FILTER_CHANGE,
  StudioProjectSettings
} from "../../src/project/StudioProjectSettings.ts";

class SettingsBackend {
  reads = 0;
  updates: SettingsUpdate[] = [];
  #revision = 1;
  #reply: ProjectSettingsReply = {
    revision: "1",
    name: "project",
    editors: [],
    kinds: [],
    ...DEFAULT_PROJECT_SECTIONS
  };

  read = async(): Promise<ProjectSettingsReply> => {
    this.reads++;

    return this.#reply;
  };

  replace = async(
    update: SettingsUpdate
  ): Promise<ProjectSettingsReply> => {
    const sent: SettingsUpdate = JSON.parse(JSON.stringify(update));
    this.updates.push(sent);
    if (sent.revision !== this.#reply.revision) {
      throw new ApiRequestError(409, "stale", "stale-settings");
    }

    return this.saveElsewhere(sent.sections);
  };

  saveElsewhere(
    sections: SettingsUpdate["sections"] = {}
  ): ProjectSettingsReply {
    this.#reply = {
      ...this.#reply,
      ...projectSectionsSchema.partial().parse(sections),
      revision: String(++this.#revision)
    };

    return this.#reply;
  }
}

async function settings(
  backend = new SettingsBackend()
): Promise<StudioProjectSettings> {
  const project = new StudioProjectSettings(
    backend,
    ProjectRights.NONE,
    DEFAULT_PROJECT_SECTIONS
  );
  await project.load();

  return project;
}

describe("StudioProjectSettings", () => {
  test("announces the kind filter only when a reply changes it", async() => {
    const project = await settings();
    let changes = 0;
    project.addEventListener(KIND_FILTER_CHANGE, () => changes++);

    project.drafts.section("kindFilter").edit(new KindFilter(["voxelmodel"]));
    await project.save();
    await project.load();

    assert.strictEqual(changes, 1);
    assert.deepEqual(project.kindFilter.hidden, ["voxelmodel"]);
  });

  test("announces the default scene only when a reply changes it", async() => {
    const project = await settings();
    let changes = 0;
    project.addEventListener(GAME_CHANGE, () => changes++);

    project.drafts.section("game").edit({ start: "arena" });
    await project.save();
    await project.load();

    assert.strictEqual(changes, 1);
    assert.deepEqual(project.game, { start: "arena" });
  });

  test("counts an edit as unsaved only when it differs from the saved section", async() => {
    const project = await settings();

    project.drafts.section("game").edit({ start: null });
    assert.equal(project.drafts.changed, false);

    project.drafts.section("game").edit({ start: "arena" });
    assert.equal(project.drafts.changed, true);
  });

  test("saves every changed section in one update with the read revision, then drops the drafts", async() => {
    const backend = new SettingsBackend();
    const project = await settings(backend);
    project.drafts.section("kindFilter").edit(new KindFilter(["voxelmap"]));
    project.drafts.section("game").edit({ start: "arena" });
    const physics = project.drafts.section("physics").saved;
    assert.ok(physics !== null);
    project.drafts.section("physics").edit(physics);

    assert.equal(await project.save(), true);

    assert.deepEqual(backend.updates, [
      {
        revision: "1",
        sections: {
          kindFilter: {
            hidden: ["voxelmap"]
          },
          game: {
            start: "arena"
          }
        }
      }
    ]);
    assert.equal(project.drafts.changed, false);
    assert.deepEqual(project.drafts.section("game").current, { start: "arena" });
  });

  test("keeps the drafts and flags a conflict on settings saved elsewhere, then overwrites", async() => {
    const backend = new SettingsBackend();
    const project = await settings(backend);
    backend.saveElsewhere({
      game: {
        start: "lobby"
      }
    });
    project.drafts.section("game").edit({ start: "arena" });

    assert.equal(await project.save(), false);
    assert.equal(project.conflict, true);
    assert.equal(project.drafts.changed, true);

    assert.equal(await project.overwrite(), true);
    assert.equal(project.conflict, false);
    assert.deepEqual(project.game, { start: "arena" });
  });

  test("clears the conflict when the settings saved elsewhere already hold the edit", async() => {
    const backend = new SettingsBackend();
    const project = await settings(backend);
    project.drafts.section("game").edit({ start: "arena" });
    backend.saveElsewhere({
      game: {
        start: "arena"
      }
    });
    assert.equal(await project.save(), false);
    assert.equal(project.conflict, true);

    assert.equal(await project.overwrite(), false);

    assert.equal(project.conflict, false);
    assert.equal(project.drafts.changed, false);
    assert.equal(backend.updates.length, 1);
  });

  test("shares one read between overlapping loads", async() => {
    const backend = new SettingsBackend();
    const project = await settings(backend);

    await Promise.all([project.load(), project.load()]);

    assert.equal(backend.reads, 2);
  });

  test("drops the drafts and shows the newest settings on reload after a conflict", async() => {
    const backend = new SettingsBackend();
    const project = await settings(backend);
    backend.saveElsewhere({
      game: {
        start: "lobby"
      }
    });
    project.drafts.section("game").edit({ start: "arena" });
    await project.save();

    await project.reload();

    assert.equal(project.conflict, false);
    assert.equal(project.drafts.changed, false);
    assert.deepEqual(project.drafts.section("game").current, { start: "lobby" });
  });
});
