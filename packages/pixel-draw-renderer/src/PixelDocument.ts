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
  ColorInput,
  Vec2
} from "./types.ts";

export interface PixelDocumentOptions {
  /**
   * Initial texture size.
   */
  size: Vec2;
  /**
   * Default fill color for the buffer.
   */
  defaultColor?: ColorInput;
  /**
   * Maximum buffer dimension.
   */
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
 * The editable model: the pixel buffer, its UV regions, and the undo/redo
 * history. It owns the wiring the three need between them (the UV map reads
 * the buffer size; history observes both), so constructing a document is one
 * call rather than three ordered steps.
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
   * Subscribes to visible buffer mutations (stroke / region edits). The view
   * repaints on these; size-changing edits are driven explicitly instead.
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
