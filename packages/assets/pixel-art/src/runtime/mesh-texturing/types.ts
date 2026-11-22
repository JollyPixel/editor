// Import Third-party Dependencies
import type {
  NormalMap,
  NormalMapConfig,
  PixelDocumentEvent,
  UVSlot,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export interface PixelTextureDocument {
  readonly normalMap: NormalMapConfig | null;
  readonly normals: NormalMap;
  on<E extends keyof PixelDocumentEvent>(
    event: E,
    listener: PixelDocumentEvent[E]
  ): unknown;
  off<E extends keyof PixelDocumentEvent>(
    event: E,
    listener: PixelDocumentEvent[E]
  ): unknown;
}

export interface PixelTextureSource {
  readonly document: PixelTextureDocument;
  readonly textureSize: Vec2;
  textureCanvas(): HTMLCanvasElement;
}

export interface FaceVertexRange {
  start: number;
  count: number;
}

export type FaceRanges = Partial<
  Record<UVSlot, readonly FaceVertexRange[]>
>;
