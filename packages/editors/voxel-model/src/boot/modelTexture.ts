// Import Third-party Dependencies
import { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import {
  PIXEL_ART_KIND,
  pixelArtModelKind,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { EditorSession } from "@jolly-pixel/editor.host";

// CONSTANTS
const kLocalTextureSize = { x: 64, y: 64 };
export const MODEL_TEXTURE_KIND = pixelArtModelKind();

export interface ModelTexture {
  document: PixelDocument;
  ready: Promise<void>;
  room?: PixelArtRoom;
  release(): void;
}

export function openModelTexture(
  session: EditorSession
): ModelTexture {
  const reference = session.catalog
    .dependenciesOf(session.target.record.id)
    .find((dependency) => dependency.kind === PIXEL_ART_KIND);
  if (reference === undefined) {
    return {
      document: new PixelDocument({
        size: kLocalTextureSize
      }),
      ready: Promise.resolve(),
      release: () => void 0
    };
  }

  const lease = session.assets.open(MODEL_TEXTURE_KIND, reference.id);

  return {
    document: lease.model,
    ready: lease.ready,
    room: lease.room,
    release: () => lease.release()
  };
}
