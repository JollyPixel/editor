// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  PeerStrokePixel,
  Vec2
} from "../../types.ts";

export type PeerStrokesEvent = {
  changed: () => void;
};

/**
 * Renders non-authoritative peer strokes without mutating the document.
 */
export class PeerStrokes extends Emitter<
  PeerStrokesEvent
> {
  #pixels = new Map<string, PeerStrokePixel[]>();

  set(
    clientId: string,
    pixels: PeerStrokePixel[]
  ): void {
    this.#pixels.set(clientId, pixels);
    this.emit("changed");
  }

  remove(
    clientId: string
  ): void {
    const had = this.#pixels.delete(clientId);

    if (had) {
      this.emit("changed");
    }
  }

  get isActive(): boolean {
    return this.#pixels.size > 0;
  }

  draw(
    ctx: CanvasRenderingContext2D
  ): void {
    for (const pixels of this.#pixels.values()) {
      for (const { x, y, color } of pixels) {
        const alpha = color.a / 255;

        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  clearAll(): void {
    for (const clientId of [...this.#pixels.keys()]) {
      this.remove(clientId);
    }
  }

  /**
   * Matches pixels because presence and command peer ids may differ.
   */
  removeOverlapping(
    positions: Vec2[]
  ): void {
    if (positions.length === 0) {
      return;
    }

    const committed = new Set(
      positions.map(({ x, y }) => `${x},${y}`)
    );
    for (const [clientId, pixels] of [...this.#pixels.entries()]) {
      const hasOverlap = pixels.some(
        ({ x, y }) => committed.has(`${x},${y}`)
      );
      if (hasOverlap) {
        this.remove(clientId);
      }
    }
  }

  destroy(): void {
    this.#pixels.clear();
  }
}
