// Import Third-party Dependencies
import { SOUND_ASSET } from "@jolly-pixel/asset.sound/client";
import type {
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import type {
  AudioSourceAssets,
  AudioSourceSettings,
  AudioZoneAssets,
  AudioZoneSettings,
  Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  AUDIO_LISTENER_DEFINITION,
  AUDIO_SOURCE_DEFINITION,
  AUDIO_ZONE_DEFINITION
} from "../runtime/index.ts";
import {
  audioSourceForm,
  audioZoneForm
} from "./audioForms.ts";
import "./sceneIcons.ts";

// CONSTANTS
const kAudioSource: SceneComponentKind<AudioSourceSettings, AudioSourceAssets> = {
  definition: AUDIO_SOURCE_DEFINITION,
  label: "Audio source",
  category: "audio",
  icon: "audio-source",
  form: audioSourceForm
};
const kAudioListener: SceneComponentKind<Systems.JSONObject> = {
  definition: AUDIO_LISTENER_DEFINITION,
  label: "Audio listener",
  category: "audio",
  icon: "audio-listener",
  form: () => []
};
const kAudioZone: SceneComponentKind<AudioZoneSettings, AudioZoneAssets> = {
  definition: AUDIO_ZONE_DEFINITION,
  label: "Audio zone",
  category: "audio",
  icon: "audio-zone",
  optionalAssets: ["sound"],
  form: audioZoneForm
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kAudioSource, kAudioListener, kAudioZone],
  assets: [
    {
      descriptor: SOUND_ASSET,
      documentKinds: [],
      open: () => {
        return {
          resolve: () => null,
          dispose: () => undefined
        };
      }
    }
  ]
};
