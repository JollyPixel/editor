// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  environmentAssetKind,
  EnvironmentState
} from "#src/index.ts";

function encodeJSON(
  value: unknown
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

describe("environment kind", () => {
  test("creates the engine's default environment", () => {
    const state = environmentAssetKind().create?.("dusk");

    assert.deepEqual(state?.snapshot(), Systems.ENVIRONMENT_PRESETS.default);
  });

  test("loads a stored environment and stores it back unchanged", async() => {
    const kind = environmentAssetKind();
    const state = new EnvironmentState();
    const night = Systems.ENVIRONMENT_PRESETS.night;

    kind.load(state, encodeJSON(night));
    const stored = JSON.parse(new TextDecoder().decode(await kind.serialize(state)));

    assert.deepEqual(stored, night);
  });

  test("refuses a stored environment with a malformed color", () => {
    const kind = environmentAssetKind();
    const file = {
      ...Systems.ENVIRONMENT_PRESETS.default,
      sky: { kind: "color", color: "red" }
    };

    assert.throws(
      () => kind.load(new EnvironmentState(), encodeJSON(file)),
      InvalidAssetFileError
    );
  });

  test("builds the environment file a game reads", async() => {
    const kind = environmentAssetKind();
    const state = new EnvironmentState();
    state.load(Systems.ENVIRONMENT_PRESETS.day);

    const built = await kind.build?.build(state, {} as never);

    assert.deepEqual(
      JSON.parse(new TextDecoder().decode(built as Uint8Array)),
      Systems.ENVIRONMENT_PRESETS.day
    );
  });
});
