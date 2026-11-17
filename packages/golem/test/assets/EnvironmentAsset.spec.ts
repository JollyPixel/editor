// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  createEnvironmentFile,
  environmentDocumentKind
} from "@jolly-pixel/asset.environment/client";

// Import Internal Dependencies
import type { EnvironmentAsset } from "#src/assets/environment/EnvironmentAsset.ts";
import { Golem } from "#src/peer/Golem.ts";
import { AssetPeer } from "../helpers/AssetPeer.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

async function createEnvironment(
  golem: Golem
): Promise<EnvironmentAsset> {
  const assetId = await golem.catalog.create("environments/dusk.environment.json", null);

  return golem.open(assetId, "environment");
}

describe("EnvironmentAsset", { timeout: 10_000 }, () => {
  test("merges fields into sections while a person changes another one", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const environment = await createEnvironment(golem);
    using person = await AssetPeer.join({
      socketUrl: backend.socketUrl,
      credential: (await createAgentToken(backend, bob, "Watcher")).value,
      assetId: environment.id,
      documentKind: environmentDocumentKind()
    });
    const { file } = person.synced.document;

    person.synced.document.change({
      toneMapping: {
        kind: "aces",
        exposure: 1
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
    await person.until(() => person.synced.document.file.sun?.elevation === 12);

    assert.deepEqual(changed, ["sun", "ambient", "fog"]);
    const expected = {
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
    };
    assert.deepEqual(person.synced.document.file, expected);
    await person.until(() => environment.read().toneMapping.kind === "aces");
    assert.deepEqual(environment.read(), expected);
  });

  test("starts from a preset, and sends nothing for a field the kind lacks", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const environment = await createEnvironment(golem);

    await environment.change({ glow: { strength: 2 } }, { preset: "night" });
    await environment.settled();

    assert.deepEqual(environment.read(), {
      ...createEnvironmentFile("night"),
      glow: {
        strength: 2,
        radius: 0.4
      }
    });
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
    assert.equal(environment.unanswered, 0);
    assert.deepEqual(await environment.change({ sky: { kind: "night" } }), []);
    assert.equal(environment.read().sky.kind, "night");
  });
});
