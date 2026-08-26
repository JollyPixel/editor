// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  CanvasBuffer,
  type CanvasBufferEvent
} from "./buffer/CanvasBuffer.ts";
import {
  History,
  type HistoryState
} from "./history/History.ts";
import { UVMap } from "./uv/UVMap.ts";
import type {
  ByteColorInput,
  Vec2
} from "./types.ts";

export interface PixelDocumentOptions {
  size: Vec2;
  defaultColor?: ByteColorInput;
  maxSize?: number;
  /**
   * Initial texture loaded over the filled buffer.
   */
  init?: HTMLCanvasElement;
  history?: {
    enabled?: boolean;
    limit?: number;
    onChange?: (state: HistoryState) => void;
  };
}

/**
 * Buffer events forwarded verbatim.
 */
export type PixelDocumentEvent = CanvasBufferEvent;

/**
 * Owns the buffer, UV map, history, and their shared wiring.
 */
export class PixelDocument extends Emitter<
  PixelDocumentEvent
> {
  readonly buffer: CanvasBuffer;
  readonly uv: UVMap;
  readonly history: History;

  constructor(
    options: PixelDocumentOptions
  ) {
    super();

    this.buffer = new CanvasBuffer({
      size: options.size,
      defaultColor: options.defaultColor,
      maxSize: options.maxSize
    });

    if (options.init) {
      this.buffer.loadTexture(options.init);
    }

    this.uv = new UVMap({
      getCanvasSize: () => this.buffer.size()
    });

    this.history = new History(this.buffer, this.uv, {
      enabled: options.history?.enabled,
      limit: options.history?.limit,
      onChange: options.history?.onChange
    });

    this.buffer.on("changed", (event) => this.emit("changed", event));
    this.buffer.on("resized", (event) => this.emit("resized", event));
    this.buffer.on("replaced", (event) => this.emit("replaced", event));
  }

  size(): Vec2 {
    return this.buffer.size();
  }
}
