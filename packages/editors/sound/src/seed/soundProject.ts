// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import {
  oggContentFromAudio,
  SOUND_KIND
} from "@jolly-pixel/asset.sound";

// Import Internal Dependencies
import { Chime } from "./Chime.ts";

export interface SoundProject {
  seed: AssetSeedMap;
}

export function createSoundProject(): SoundProject {
  return {
    seed: {
      "sounds/chime.ogg": {
        id: crypto.randomUUID(),
        kind: SOUND_KIND,
        content: () => oggContentFromAudio(
          new Chime().waveFile()
        )
      }
    }
  };
}
