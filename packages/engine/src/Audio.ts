// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { GameInstance } from "./systems/GameInstance.js";

export function createAudio(
  gameInstance: GameInstance,
  assetPath: string
): THREE.Audio {
  const sound = new THREE.Audio(gameInstance.audio);
  sound.name = getAssetName(assetPath);

  gameInstance.loader.audio.load(assetPath, (buffer) => {
    sound.setBuffer(buffer);
  });

  return sound;
}

export function createPositionalAudio(
  gameInstance: GameInstance,
  assetPath: string
): THREE.PositionalAudio {
  const sound = new THREE.PositionalAudio(gameInstance.audio);
  sound.name = getAssetName(assetPath);

  gameInstance.loader.audio.load(assetPath, (buffer) => {
    sound.setBuffer(buffer);
  });

  return sound;
}

function getAssetName(assetPath: string): string {
  return assetPath.split(/(\\|\/)/g).pop() ?? assetPath;
}
