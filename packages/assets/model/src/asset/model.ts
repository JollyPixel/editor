// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// CONSTANTS
export const MODEL_KIND = "model";
export const MODEL_COMMAND = "model.command";
export const MODEL_EXTENSIONS: Readonly<Record<string, string>> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".fbx": "application/octet-stream",
  ".obj": "model/obj"
};

export const MODEL_ASSET: AssetKindDescriptor = {
  kind: MODEL_KIND,
  label: "3D model",
  extension: ".glb",
  creatable: false,
  icon: {
    svg: `
      <path d="M32 6 56 19 V45 L32 58 L8 45 V19 Z" fill="#1d2733" />
      <path d="M32 10 52 21 32 32 12 21 Z" fill="#8fd3f4" />
      <path d="M12 21 32 32 V54 L12 43 Z" fill="#4a90c2" />
      <path d="M52 21 32 32 V54 L52 43 Z" fill="#2f6690" />
    `,
    viewBox: "0 0 64 64"
  }
};
