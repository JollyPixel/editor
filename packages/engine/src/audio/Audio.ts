// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { GameInstance } from "../systems/GameInstance.js";
import * as path from "../utils/path.js";

export interface AudioOptions {
  assetPath: string;
  name?: string;
  volume?: number;
  play?: boolean;
}

export async function createAudio(
  gameInstance: GameInstance,
  options: AudioOptions
): Promise<{ sound: THREE.Audio; buffer: AudioBuffer; }> {
  const { assetPath, name, volume = 1, play = false } = options;

  const sound = new THREE.Audio(gameInstance.audio.listener);
  sound.name = name ?? path.parse(assetPath).name;

  const buffer = await gameInstance.loader.audio.loadAsync(assetPath);
  sound.setBuffer(buffer);
  sound.setVolume(volume * gameInstance.audio.globalVolume);
  if (play) {
    sound.play();
  }

  return { sound, buffer };
}

export async function createPositionalAudio(
  gameInstance: GameInstance,
  options: AudioOptions
): Promise<{ sound: THREE.PositionalAudio; buffer: AudioBuffer; }> {
  const { assetPath, name, volume = 1, play = false } = options;

  const sound = new THREE.PositionalAudio(gameInstance.audio.listener);
  sound.name = name ?? path.parse(assetPath).name;

  const buffer = await gameInstance.loader.audio.loadAsync(assetPath);
  sound.setBuffer(buffer);
  sound.setVolume(volume * gameInstance.audio.globalVolume);
  if (play) {
    sound.play();
  }

  return { sound, buffer };
}

export function destroyAudio(
  audio: THREE.Audio | THREE.PositionalAudio
): void {
  if (audio.isPlaying) {
    audio.stop();
  }
  audio.disconnect();
  audio.buffer = null;
}
