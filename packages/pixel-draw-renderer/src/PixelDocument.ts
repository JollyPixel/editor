// Import Internal Dependencies
import {
  CanvasBuffer
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
   * Initial texture source, loaded over the freshly-filled buffer.
   */
  init?: HTMLCanvasElement;
  history?: {
    enabled?: boolean;
    limit?: number;
    onChange?: (state: HistoryState) => void;
  };
}

/**
 * Owns the buffer, UV map, history, and their shared wiring.
 */
export class PixelDocument {
  readonly buffer: CanvasBuffer;
  readonly uv: UVMap;
  readonly history: History;

  constructor(
    options: PixelDocumentOptions
  ) {
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
  }

  size(): Vec2 {
    return this.buffer.size();
  }

  /**
   * Subscribes to visible mutations; size changes are driven separately.
   */
  onChange(
    listener: () => void
  ): void {
    this.buffer.on("changed", listener);
  }

  offChange(
    listener: () => void
  ): void {
    this.buffer.off("changed", listener);
  }
}
