// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// CONSTANTS
export const SOUND_KIND = "sound";
export const SOUND_COMMAND = "sound.command";
export const SOUND_EXTENSION = ".ogg";
export const SOUND_CONTENT_TYPE = "audio/ogg";
export const SOUND_SOURCE_EXTENSIONS = [
  ".wav",
  ".mp3",
  ".flac",
  ".m4a",
  ".aac"
] as const;

export const SOUND_ASSET: AssetKindDescriptor = {
  kind: SOUND_KIND,
  label: "Sound",
  extension: SOUND_EXTENSION,
  creatable: false,
  icon: {
    svg: `
      <rect x="5" y="5" width="54" height="54" rx="6" fill="#16232b" />
      <rect x="9" y="9" width="46" height="46" rx="4" fill="#e3f1f4" />
      <path d="M16 26 H24 L34 17 V47 L24 38 H16 Z" fill="#1f6f8b" />
      <path
        d="M39 25 Q44 32 39 39"
        fill="none" stroke="#e0803a" stroke-width="3.5" stroke-linecap="round"
      />
      <path
        d="M43.5 20 Q52 32 43.5 44"
        fill="none" stroke="#e0803a" stroke-width="3.5" stroke-linecap="round"
      />
    `,
    viewBox: "0 0 64 64"
  }
};
