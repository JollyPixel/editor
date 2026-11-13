// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DEFAULT_PHYSICS } from "#src/project/api.ts";
import { InvalidSettingsError } from "#src/node/project/errors/InvalidSettingsError.ts";
import { StaleSettingsError } from "#src/node/project/errors/StaleSettingsError.ts";
import { settingsHarness } from "../../helpers/settingsHarness.ts";

// CONSTANTS
const kVoxelMapKinds = "@jolly-pixel/asset.voxel-map";

describe("ProjectSettings.replace with several sections", () => {
  test("writes every section of a batch and audits each one", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const physics = { ...DEFAULT_PHYSICS, gravity: { x: 0, y: -1.62, z: 0 } };

    await harness.updateAll(admin, {
      kindFilter: {
        hidden: ["voxelmap"]
      },
      physics
    });

    assert.deepEqual(harness.project.file.data.kindFilter, { hidden: ["voxelmap"] });
    assert.deepEqual(harness.project.file.data.physics, physics);
    const events = await harness.audit.store.reader.listAll();
    assert.deepEqual(events.map(({ eventData }) => eventData), [
      {
        section: "kindFilter",
        before: { hidden: [] },
        after: { hidden: ["voxelmap"] }
      },
      {
        section: "physics",
        before: DEFAULT_PHYSICS,
        after: physics
      }
    ]);
  });

  test("writes no section of a batch when one is invalid", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");

    const kinds = Object.fromEntries(
      harness.settings.read(admin).kinds.map(({ name, options }) => [name, options])
    );
    const chunkSize = harness.voxelMapChunkSize();

    await assert.rejects(
      harness.updateAll(admin, {
        kinds: {
          ...kinds,
          [kVoxelMapKinds]: {
            voxelmap: {
              chunkSize: 8
            }
          }
        },
        kindFilter: {
          hidden: ["unknown"]
        }
      }),
      InvalidSettingsError
    );

    assert.equal(harness.voxelMapChunkSize(), chunkSize);
    assert.deepEqual(
      harness.project.file.kinds.get(kVoxelMapKinds),
      kinds[kVoxelMapKinds]
    );
    assert.deepEqual(await harness.audit.store.reader.listAll(), []);
  });

  test("refuses a batch read before another save, leaving the settings as saved", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const { revision } = harness.settings.read(admin);
    await harness.update(admin, "game", { start: "arena" });

    await assert.rejects(
      harness.settings.replace(admin, {
        revision,
        sections: {
          game: {
            start: null
          }
        }
      }),
      StaleSettingsError
    );

    assert.deepEqual(harness.settings.sections().game, { start: "arena" });
  });
});
