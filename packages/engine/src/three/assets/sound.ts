// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { OggHeader } from "../../core/systems/audio/OggHeader.ts";
import { readSoundSettings } from "../../core/systems/audio/SoundSettings.ts";
import { Sound } from "../audio/Sound.ts";

export const SoundAssetType = new AssetType<Sound>("sound");

export class SoundAssetLoader implements AssetLoader<Sound> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<Sound> {
    const content = await new THREE.FileLoader(this.#manager)
      .setResponseType("arraybuffer")
      .loadAsync(record.path.toString());
    if (!(content instanceof ArrayBuffer)) {
      throw new TypeError(`Sound "${record.path}" did not load as bytes.`);
    }

    const settings = readSoundSettings(
      OggHeader.parse(new Uint8Array(content))
    );
    const buffer = await sharedAudioContext().decodeAudioData(content);

    return new Sound(buffer, settings);
  }
}

function sharedAudioContext(): BaseAudioContext {
  const context: unknown = THREE.AudioContext.getContext();

  return context as BaseAudioContext;
}
