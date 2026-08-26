// Import Third-party Dependencies
import type {
  CanvasBufferEvent,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

/**
 * Structural event source; unknown returns accept Emitter's fluent methods.
 */
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

/**
 * Minimal structural source required by a texture bridge.
 */
export interface PixelTextureSource {
  readonly document: PixelDocumentEvents;
  readonly textureSize: Vec2;
  textureCanvas(): HTMLCanvasElement;
}
