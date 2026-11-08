// Import Third-party Dependencies
import {
  TEXTURE_KIND,
  type AssetSeedMap
} from "@jolly-pixel/asset-server";
import { decodeBase64 } from "@jolly-pixel/utils";

// CONSTANTS
const kPotionPng = [
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAArUlEQVR4nGNgoBAw",
  "4pJQUjD5j8y/9+AMVrVM+EzPNWMHY7IByBXoLiFJ8+nbf/JAGJ8hWP0F0rBy94l8",
  "ZLFwV4uJ2MIBQwCbZnyGoHBAmu/mlDHcOr0Tl4sZPE9eRIkRRlI0YzMEJRpBmtVW",
  "zCFoADLAmg7wGbL54mMUPgu6glsRKeS7AN10QrYzYIuFLA4hMNtXXxar5mk/3mGP",
  "BWRDQDTMIBgAaWTAkqkozo0A73RYWhjnwGUAAAAASUVORK5CYII="
].join("");

export interface TextureProject {
  seed: AssetSeedMap;
}

export function createTextureProject(): TextureProject {
  return {
    seed: {
      "textures/potion.png": {
        id: crypto.randomUUID(),
        kind: TEXTURE_KIND,
        content: potionPng
      }
    }
  };
}

function potionPng(): Uint8Array {
  const bytes = decodeBase64(kPotionPng);
  if (bytes === null) {
    throw new Error("The seeded potion sprite is not valid base64.");
  }

  return bytes;
}
