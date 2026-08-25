// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  buildMaskedContentCanvas,
  buildMaskedFillCanvas
} from "../compositing/selectionCanvas.ts";
import { Select } from "../../tools/Select.ts";
import {
  positionKeySet,
  rectOverlapsPositionKeys
} from "../../utils/math.ts";
import type { CanvasBuffer } from "../../buffer/CanvasBuffer.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../../types.ts";

// CONSTANTS
const kOpaqueMask: RGBA8 = {
  r: 0,
  g: 0,
  b: 0,
  a: 255
};

export interface PeerFloatingSelectionState {
  sourceRect: SelectionRect;
  liveRect: SelectionRect;
  mask: boolean[];
  blankSource: boolean;
}

interface PeerFloatingEntry {
  sourceKey: string;
  content: HTMLCanvasElement;
  eraseCanvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;
  sourceRect: SelectionRect;
  liveRect: SelectionRect;
  mask: boolean[];
  blankSource: boolean;
}

export type PeerFloatingSelectionsEvent = {
  changed: () => void;
};

function rectKey(
  rect: SelectionRect
): string {
  return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}

/**
 * Recreates non-authoritative selection moves from the shared buffer.
 */
export class PeerFloatingSelections extends Emitter<
  PeerFloatingSelectionsEvent
> {
  #canvasBuffer: CanvasBuffer;
  #eraseColor: RGBA8 | null;
  #entries = new Map<string, PeerFloatingEntry>();

  constructor(
    canvasBuffer: CanvasBuffer,
    eraseColor: RGBA8 | null
  ) {
    super();
    this.#canvasBuffer = canvasBuffer;
    this.#eraseColor = eraseColor;
  }

  set(
    clientId: string,
    state: PeerFloatingSelectionState
  ): void {
    const sourceKey = rectKey(state.sourceRect);
    const existing = this.#entries.get(clientId);

    if (
      existing &&
      existing.sourceKey === sourceKey
    ) {
      // Reposition later ticks without resampling the shared buffer.
      existing.liveRect = state.liveRect;
      existing.blankSource = state.blankSource;
    }
    else {
      const pixels = Select.captureSnapshot(
        this.#canvasBuffer,
        state.sourceRect
      );
      const eraseColor = Select.resolveEraseColor(
        this.#canvasBuffer,
        state.sourceRect,
        this.#eraseColor
      );

      this.#entries.set(clientId, {
        sourceKey,
        content: buildMaskedContentCanvas(
          state.sourceRect,
          pixels,
          state.mask
        ),
        eraseCanvas: buildMaskedFillCanvas(
          state.sourceRect,
          state.mask,
          eraseColor
        ),
        maskCanvas: buildMaskedFillCanvas(
          state.sourceRect,
          state.mask,
          kOpaqueMask
        ),
        sourceRect: state.sourceRect,
        liveRect: state.liveRect,
        mask: state.mask,
        blankSource: state.blankSource
      });
    }

    this.emit("changed");
  }

  remove(
    clientId: string
  ): void {
    const had = this.#entries.delete(clientId);

    if (had) {
      this.emit("changed");
    }
  }

  get isActive(): boolean {
    return this.#entries.size > 0;
  }

  draw(
    ctx: CanvasRenderingContext2D
  ): void {
    for (const entry of this.#entries.values()) {
      if (entry.blankSource) {
        PeerFloatingSelections.#clearMaskedRect(
          ctx,
          entry.maskCanvas,
          entry.sourceRect
        );
        ctx.drawImage(
          entry.eraseCanvas,
          entry.sourceRect.x,
          entry.sourceRect.y
        );
      }

      PeerFloatingSelections.#clearMaskedRect(
        ctx,
        entry.maskCanvas,
        entry.liveRect
      );
      ctx.drawImage(
        entry.content,
        entry.liveRect.x,
        entry.liveRect.y,
        entry.liveRect.width,
        entry.liveRect.height
      );
    }
  }

  clearAll(): void {
    for (const clientId of [...this.#entries.keys()]) {
      this.remove(clientId);
    }
  }

  /**
   * Matches content because presence and command peer ids may differ.
   */
  removeOverlapping(
    positions: Vec2[]
  ): void {
    if (positions.length === 0) {
      return;
    }

    const committed = positionKeySet(positions);
    for (const [clientId, entry] of [...this.#entries.entries()]) {
      if (
        rectOverlapsPositionKeys(
          entry.liveRect,
          entry.mask,
          committed
        ) ||
        rectOverlapsPositionKeys(
          entry.sourceRect,
          entry.mask,
          committed
        )
      ) {
        this.remove(clientId);
      }
    }
  }

  destroy(): void {
    this.#entries.clear();
  }

  static #clearMaskedRect(
    ctx: CanvasRenderingContext2D,
    maskCanvas: HTMLCanvasElement,
    rect: SelectionRect
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(
      maskCanvas,
      rect.x,
      rect.y
    );
    ctx.restore();
  }
}
