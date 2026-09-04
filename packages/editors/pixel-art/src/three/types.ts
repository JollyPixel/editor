// Import Third-party Dependencies
import type {
  CanvasBufferEvent,
  UVFace,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export interface PixelDocumentEvents {
  on<E extends keyof CanvasBufferEvent>(
    event: E,
    listener: CanvasBufferEvent[E]
  ): unknown;
  off<E extends keyof CanvasBufferEvent>(
    event: E,
    listener: CanvasBufferEvent[E]
  ): unknown;
}

export interface PixelTextureSource {
  readonly document: PixelDocumentEvents;
  readonly textureSize: Vec2;
  textureCanvas(): HTMLCanvasElement;
}

export interface FaceVertexRange {
  start: number;
  count: number;
}

export type FaceRanges = Partial<
  Record<UVFace, readonly FaceVertexRange[]>
>;
