// Import Third-party Dependencies
import type { PeerStrokePixel } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PeerGhostLayer } from "./PeerGhostStream.ts";
import type { StrokeGhostFrame } from "../types.ts";

export class StrokeGhostLayer implements PeerGhostLayer<StrokeGhostFrame> {
  #strokes: PeerGhostLayer<PeerStrokePixel[]>;
  #peers = new Map<string, PeerStrokePixel[]>();

  constructor(
    strokes: PeerGhostLayer<PeerStrokePixel[]>
  ) {
    this.#strokes = strokes;
  }

  set(
    clientId: string,
    frame: StrokeGhostFrame
  ): void {
    const pixels = frame.from === 0 ?
      [] :
      this.#peers.get(clientId) ?? [];
    for (const { color, xy } of frame.spans) {
      for (let i = 0; i < xy.length; i += 2) {
        pixels.push({
          x: xy[i],
          y: xy[i + 1],
          color
        });
      }
    }

    this.#peers.set(clientId, pixels);
    this.#strokes.set(clientId, pixels);
  }

  remove(
    clientId: string
  ): void {
    this.#peers.delete(clientId);
    this.#strokes.remove(clientId);
  }

  clearAll(): void {
    this.#peers.clear();
    this.#strokes.clearAll();
  }
}
