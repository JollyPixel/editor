// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { AnimationPlayer } from "#src/player/AnimationPlayer.ts";

function spinClip(): THREE.AnimationClip {
  return new THREE.AnimationClip("spin", 1, [
    new THREE.NumberKeyframeTrack(".rotation[y]", [0, 1], [0, 1])
  ]);
}

function createPlayer() {
  const root = new THREE.Object3D();
  const player = new AnimationPlayer(() => undefined);
  player.load(root, [
    spinClip(),
    new THREE.AnimationClip("lift", 2, [
      new THREE.NumberKeyframeTrack(".position[y]", [0, 2], [0, 2])
    ])
  ]);

  return { root, player };
}

function rounded(
  value: number
): number {
  return Number(value.toFixed(6));
}

describe("AnimationPlayer", () => {
  test("lists the clips and selects the first one", () => {
    const { player } = createPlayer();

    assert.deepEqual(player.clips, [
      { name: "spin", duration: 1 },
      { name: "lift", duration: 2 }
    ]);
    assert.deepEqual([player.selected, player.duration], ["spin", 1]);
  });

  test("poses the model at the scrubbed time without playing", () => {
    const { root, player } = createPlayer();

    player.seek(0.25);

    assert.equal(player.playing, false);
    assert.equal(player.time, 0.25);
    assert.equal(root.rotation.y, 0.25);
  });

  test("plays the newly selected clip from its start while playing", () => {
    const { root, player } = createPlayer();
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
    const { root, player } = createPlayer();
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
    const { player } = createPlayer();
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
