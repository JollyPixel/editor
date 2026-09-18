// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

export const AUDIO_ASSET = new AssetType<AudioBuffer>("audio");

export function loadAudioBuffer(
  url: string,
  manager?: THREE.LoadingManager
): Promise<AudioBuffer> {
  return new THREE.AudioLoader(manager).loadAsync(url);
}

/**
 * Loads audio records with the Three.js loading manager owned by the runtime.
 */
export class AudioAssetLoader implements AssetLoader<AudioBuffer> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  load(
    record: AssetRecord
  ): Promise<AudioBuffer> {
    return loadAudioBuffer(record.source, this.#manager);
  }
}
