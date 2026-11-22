// Import Third-party Dependencies
import {
  AudioListenerDefinition,
  AudioSourceDefinition,
  AudioZoneDefinition,
  type ThreeComponentPackage
} from "@jolly-pixel/backend.three";

// CONSTANTS
export const AUDIO_SOURCE_DEFINITION = new AudioSourceDefinition();
export const AUDIO_LISTENER_DEFINITION = new AudioListenerDefinition();
export const AUDIO_ZONE_DEFINITION = new AudioZoneDefinition();

export const RUNTIME_COMPONENTS: ThreeComponentPackage = {
  definitions: [
    AUDIO_SOURCE_DEFINITION,
    AUDIO_LISTENER_DEFINITION,
    AUDIO_ZONE_DEFINITION
  ]
};
