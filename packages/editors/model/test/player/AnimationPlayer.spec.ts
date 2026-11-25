// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { AnimationPlayer } from "#src/player/AnimationPlayer.ts";
import {
  loadedPlayer,
  rounded,
  spinClip
} from "../helpers/player.ts";

describe("AnimationPlayer", () => {
  test("lists the clips and selects the first one", () => {
    const { player } = loadedPlayer();

    assert.deepEqual(player.clips, [
      { name: "spin", duration: 1 },
      { name: "lift", duration: 2 }
    ]);
    assert.deepEqual([player.selected, player.duration], ["spin", 1]);
  });

  test("poses the model at the scrubbed time without playing", () => {
    const { root, player } = loadedPlayer();

    player.seek(0.25);

    assert.equal(player.playing, false);
    assert.equal(player.time, 0.25);
    assert.equal(root.rotation.y, 0.25);
  });

  test("plays the newly selected clip from its start while playing", () => {
    const { root, player } = loadedPlayer();
    player.play();
    player.update(0.3);

    player.select("lift");
    player.update(0.5);

    assert.equal(player.playing, true);
    assert.equal(rounded(player.time), 0.5);
    assert.equal(rounded(root.position.y), 0.5);
    assert.equal(root.rotation.y, 0);
  });

  test("returns the model to its rest pose on stop", () => {
    const { root, player } = loadedPlayer();
    player.play();
    player.update(0.5);

    player.stop();

    assert.deepEqual(
      [player.playing, player.time, root.rotation.y],
      [false, 0, 0]
    );
  });

  test("applies the speed it was given before the model loaded", () => {
    const player = new AnimationPlayer(() => undefined);
    player.speed = 2;
    player.load(new THREE.Object3D(), [spinClip()]);

    player.play();
    player.update(0.1);

    assert.equal(rounded(player.time), 0.2);
  });

  test("reports the end of a clip that does not loop", () => {
    const { player } = loadedPlayer();
    player.loop = false;
    player.play();
    player.update(0.1);
    let changes = 0;
    player.subscribe("change", () => changes++);

    player.update(1);

    assert.equal(player.playing, false);
    assert.equal(changes, 1);
  });
});
