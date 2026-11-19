// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SourcePlacement } from "#src/player/spatial/SourcePlacement.ts";
import { followingPlayer } from "../helpers/followingPlayer.ts";

describe("SoundPlayer spatial preview", () => {
  test("plays and triggers through a panner placed on the dot once Spatial is on", async() => {
    const { context, player } = await followingPlayer();

    assert.deepEqual(context.spatialInput.outputs, [context.output]);

    player.retune(player.mode
      .withPlacement(SourcePlacement.default.movedTo({
        x: 3,
        z: -4
      }))
      .withSpatial(true));
    player.trigger();

    const { panner } = context;
    assert.deepEqual(context.spatialInput.outputs, [panner]);
    assert.deepEqual(context.gains.at(-1)?.outputs, [context.spatialInput]);
    assert.equal(panner.panningModel, "HRTF");
    assert.deepEqual([panner.positionX.value, panner.positionZ.value], [3, -4]);
    assert.equal(player.mode.applySettings, true);

    player.retune(player.mode.withSpatial(false));

    assert.deepEqual(context.spatialInput.outputs, [context.output]);
  });

  test("follows the spatial settings while they are being edited", async() => {
    const { context, settings, player } = await followingPlayer();
    player.retune(player.mode.withSpatial(true));
    player.play();
    settings.preview({
      spatial: {
        distanceModel: "linear",
        refDistance: 2,
        maxDistance: 0,
        rolloffFactor: 0.5
      }
    });

    const { panner } = context;
    assert.equal(panner.distanceModel, "linear");
    assert.equal(panner.refDistance, 2);
    assert.equal(panner.rolloffFactor, 0.5);
    assert.ok(panner.maxDistance > 0);
  });

  test("moves the sound along its motion as it plays", async(t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { context, player } = await followingPlayer();
    player.retune(player.mode
      .withPlacement(SourcePlacement.default.withMotion("orbit"))
      .withSpatial(true));
    player.play();
    context.currentTime = 1;
    t.mock.timers.tick(30);

    const { panner } = context;
    assert.deepEqual(
      [Math.round(panner.positionX.value), Math.round(panner.positionZ.value)],
      [0, 2]
    );
  });

  test("turns Spatial off along with the sound settings", async() => {
    const { player } = await followingPlayer();
    player.retune(player.mode.withSpatial(true));
    player.retune(player.mode.withApplySettings(false));

    assert.equal(player.mode.spatial, false);
    assert.equal(player.spatial.sourcePoint(), null);
  });
});
