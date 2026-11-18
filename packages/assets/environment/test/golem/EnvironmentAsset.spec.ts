// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TestStudio,
  type HostedAsset
} from "@jolly-pixel/golem.kit/testing";

// Import Internal Dependencies
import {
  createEnvironmentFile,
  environmentAssetKind,
  type EnvironmentState
} from "#src/index.ts";
import {
  GOLEM_KINDS,
  type EnvironmentAsset
} from "#src/golem/index.ts";

interface OpenedEnvironment {
  environment: EnvironmentAsset;
  hosted: HostedAsset<EnvironmentState>;
}

async function openEnvironment(): Promise<OpenedEnvironment> {
  const studio = new TestStudio({ kinds: GOLEM_KINDS });
  const hosted = studio.host("environments/dusk.environment.json", environmentAssetKind());

  return {
    hosted,
    environment: await studio.open(hosted.id, "environment")
  };
}

describe("EnvironmentAsset", () => {
  test("merges fields into sections while a person changes another one", async() => {
    const { environment, hosted } = await openEnvironment();
    const file = environment.read();

    await hosted.room.receive({
      action: "environment-changed",
      set: {
        toneMapping: {
          kind: "aces",
          exposure: 1
        }
      }
    });
    const changed = await environment.change({
      fog: {
        kind: "exp2",
        density: 0.05
      },
      sun: {
        elevation: 12
      },
      ambient: {
        intensity: 0.4
      }
    });
    await environment.settled();

    assert.deepEqual(changed, ["sun", "ambient", "fog"]);
    assert.deepEqual(environment.read(), {
      ...file,
      toneMapping: {
        kind: "aces",
        exposure: 1
      },
      sun: {
        ...createEnvironmentFile("studio").sun,
        elevation: 12
      },
      ambient: {
        ...file.ambient,
        intensity: 0.4
      },
      fog: {
        kind: "exp2",
        color: "#c8d2dc",
        density: 0.05
      }
    });
  });

  test("starts from a preset, and sends nothing for a field the kind lacks", async() => {
    const { environment, hosted } = await openEnvironment();

    await environment.change({
      preset: "night",
      glow: {
        strength: 2
      }
    });
    await environment.settled();

    assert.deepEqual(environment.read(), {
      ...createEnvironmentFile("night"),
      glow: {
        strength: 2,
        radius: 0.4
      }
    });
    const sent = hosted.room.sent.length;
    await assert.rejects(
      environment.change({
        fog: {
          density: 0.1
        },
        sky: {
          kind: "day"
        }
      }),
      {
        name: "TypeError",
        message: /^fog\.density does not apply/
      }
    );
    assert.equal(hosted.room.sent.length, sent);
    assert.deepEqual(await environment.change({ sky: { kind: "night" } }), []);
  });
});
