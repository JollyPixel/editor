// Import Third-party Dependencies
import { SOUND_ASSET } from "@jolly-pixel/asset.sound/client";
import type {
  DeclaredParameter,
  SceneComponentKind,
  SceneComponentPackage,
  SignalKey
} from "@jolly-pixel/editor.host/scene";
import type {
  Systems
} from "@jolly-pixel/ecs";
import type {
  AudioSourceAssets,
  AudioSourceSettings,
  AudioZoneAssets,
  AudioZoneComponent,
  AudioZoneSettings
} from "@jolly-pixel/backend.three";
import {
  AUDIO_LISTENER_DEFINITION,
  AUDIO_SOURCE_DEFINITION,
  AUDIO_ZONE_DEFINITION
} from "@jolly-pixel/asset.sound/runtime";

// Import Internal Dependencies
import {
  audioSourceForm,
  audioZoneForm
} from "./audioForms.ts";
import "./sceneIcons.ts";

// CONSTANTS
const kTargetParameter: DeclaredParameter = {
  name: "target",
  type: "Actor | null"
};
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
  form: audioZoneForm,
  signals: () => {
    return {
      signals: [
        {
          key: "entered" satisfies SignalKey<AudioZoneComponent>,
          params: [kTargetParameter]
        },
        {
          key: "exited" satisfies SignalKey<AudioZoneComponent>,
          params: [kTargetParameter]
        }
      ],
      methods: []
    };
  }
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
