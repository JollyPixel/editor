// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  PeerStrokePixel,
  Vec2
} from "../../types.ts";

export type PeerStrokeGhostsEvent = {
  changed: () => void;
};

/**
 * Renders remote peers' in-progress (uncommitted) stroke pixels: a
 * non-authoritative, per-peer sparse pixel overlay composited on top of the
 * document buffer. Never touches `CanvasBuffer`, `History`, or conflict
 * resolution. Sync owns commit and inactivity cleanup.
 */
export class PeerStrokeGhosts extends Emitter<
  PeerStrokeGhostsEvent
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
   * Clears any peer's ghost sharing a pixel with `positions` — used on
   * reconciliation, where the committing peer's presence-observed id and
   * their command's embedded id are not guaranteed to match (see
   * PixelStrokeGhostSync). Content-based instead: a ghost sharing a pixel
   * with a commit that just landed is stale, whoever sent it.
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
