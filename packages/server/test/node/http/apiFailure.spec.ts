// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { apiFailure } from "#src/node/http/apiFailure.ts";
import { GameBuildError } from "#src/node/game/errors/GameBuildError.ts";

describe("apiFailure", () => {
  test("answers a failed game build with 422 build-failed, naming the asset", () => {
    const failure = apiFailure(
      new GameBuildError("scripts/Player.ts", new Error("\"lodash\" cannot be imported"))
    );

    assert.deepEqual(
      [failure?.status, failure?.code, failure?.message],
      [422, "build-failed", "\"scripts/Player.ts\" cannot be built: \"lodash\" cannot be imported"]
    );
  });
});
