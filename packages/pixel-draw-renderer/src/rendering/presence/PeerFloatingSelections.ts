// Import Internal Dependencies
import { FloatingSelection } from "../compositing/FloatingSelection.ts";
import { PeerLayer } from "./PeerLayer.ts";
import { CommittedPixels } from "./CommittedPixels.ts";
import { SelectionContent } from "../../selection/SelectionContent.ts";
import type { SelectionEraseColor } from "../../selection/SelectionEraseColor.ts";
import { sameRect } from "../../uv/geometry/geometry.ts";
import type { CanvasBuffer } from "../../buffer/CanvasBuffer.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../../types.ts";

export interface PeerFloatingSelectionState {
  sourceRect: SelectionRect;
  liveRect: SelectionRect;
  mask: readonly boolean[];
  blankSource: boolean;
  pixels?: readonly RGBA8[];
  eraseColor?: RGBA8;
}

interface PeerFloating {
  source: PeerFloatingSelectionState;
  view: FloatingSelection;
}

export class PeerFloatingSelections extends PeerLayer<PeerFloatingSelectionState> {
  #canvasBuffer: CanvasBuffer;
  #eraseColor: SelectionEraseColor;
  #floating = new Map<string, PeerFloating>();

  constructor(
    canvasBuffer: CanvasBuffer,
    eraseColor: SelectionEraseColor
  ) {
    super();
    this.#canvasBuffer = canvasBuffer;
    this.#eraseColor = eraseColor;
  }

  draw(
    ctx: CanvasRenderingContext2D
  ): void {
    for (const { view } of this.#floating.values()) {
      view.draw(ctx);
    }
  }

  removeOverlapping(
    positions: Vec2[]
  ): void {
    const committed = new CommittedPixels(positions);
    if (committed.isEmpty) {
      return;
    }

    this.removeWhere(
      (state) => committed.touches(state.liveRect, state.mask) ||
        committed.touches(state.sourceRect, state.mask)
    );
  }

  protected override stateChanged(
    clientId: string,
    state: PeerFloatingSelectionState
  ): void {
    const existing = this.#floating.get(clientId);
    if (
      existing !== undefined &&
      PeerFloatingSelections.#sameSource(existing.source, state)
    ) {
      existing.view.updatePosition(state.liveRect, state.blankSource);

      return;
    }

    const view = existing?.view ?? new FloatingSelection();
    view.create({
      sourceRect: state.sourceRect,
      pixels: state.pixels ??
        SelectionContent.capture(this.#canvasBuffer, state.sourceRect).pixels,
      mask: state.mask,
      eraseColor: state.eraseColor ??
        this.#eraseColor.resolve(this.#canvasBuffer, state.sourceRect),
      blankSource: state.blankSource
    });
    view.updatePosition(state.liveRect);
    this.#floating.set(clientId, { source: state, view });
  }

  protected override stateRemoved(
    clientId: string
  ): void {
    this.#floating.delete(clientId);
  }

  static #sameSource(
    a: PeerFloatingSelectionState,
    b: PeerFloatingSelectionState
  ): boolean {
    return sameRect(a.sourceRect, b.sourceRect) &&
      a.mask.length === b.mask.length &&
      a.mask.every((selected, index) => selected === b.mask[index]) &&
      PeerFloatingSelections.#sameColor(a.eraseColor, b.eraseColor) &&
      (a.pixels === b.pixels || (
        a.pixels !== undefined && b.pixels !== undefined &&
        a.pixels.length === b.pixels.length &&
        a.pixels.every((pixel, index) => (
          PeerFloatingSelections.#sameColor(pixel, b.pixels?.[index])
        ))
      ));
  }

  static #sameColor(
    a: RGBA8 | undefined,
    b: RGBA8 | undefined
  ): boolean {
    return a === b || (a !== undefined && b !== undefined &&
      a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a);
  }
}
