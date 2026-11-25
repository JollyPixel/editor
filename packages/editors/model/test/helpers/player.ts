// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { AnimationPlayer } from "#src/player/AnimationPlayer.ts";

export function spinClip(): THREE.AnimationClip {
  return new THREE.AnimationClip("spin", 1, [
    new THREE.NumberKeyframeTrack(".rotation[y]", [0, 1], [0, 1])
  ]);
}

export function liftClip(): THREE.AnimationClip {
  return new THREE.AnimationClip("lift", 2, [
    new THREE.NumberKeyframeTrack(".position[y]", [0, 2], [0, 2])
  ]);
}

export function loadedPlayer() {
  const root = new THREE.Object3D();
  const player = new AnimationPlayer(() => undefined);
  player.load(root, [spinClip(), liftClip()]);

  return {
    root,
    player
  };
}

export function rounded(
  value: number
): number {
  return Number(value.toFixed(6));
}
