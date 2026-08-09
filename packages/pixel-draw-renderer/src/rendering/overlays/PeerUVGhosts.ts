// Import Internal Dependencies
import {
  Border,
  type BorderStyle,
  type UVOverlay
} from "./UVOverlay.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type {
  UVFace,
  UVGeometry
} from "../../uv/UVRegion.ts";

// CONSTANTS
const kStrokeWidth = 2;

export interface PeerUVGhostState {
  id: string;
  face: UVFace | null;
  geometry: UVGeometry;
  color: string;
}

interface PeerBorder {
  border: Border;
  isTriangle: boolean;
}

/**
 * Renders a dashed, per-peer-colored border for a remote peer's in-progress
 * (uncommitted) UV region drag. Purely visual: never touches `UVMap` state
 * or history.
 */
export class PeerUVGhosts {
  #svg: SVGElement;
  #viewport: DefaultViewport;
  #uvOverlay: UVOverlay;
  #ghosts = new Map<string, PeerUVGhostState>();
  #borders = new Map<string, PeerBorder>();

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    uvOverlay: UVOverlay
  ) {
    this.#svg = svg;
    this.#viewport = viewport;
    this.#uvOverlay = uvOverlay;
  }

  set(
    clientId: string,
    state: PeerUVGhostState
  ): void {
    this.#ghosts.set(clientId, state);
    this.#render(clientId);
    this.#syncSuppression();
  }

  remove(
    clientId: string
  ): void {
    this.#ghosts.delete(clientId);
    this.#borders.get(clientId)?.border.remove();
    this.#borders.delete(clientId);
    this.#syncSuppression();
  }

  /**
   * Clears every peer's ghost — used when the whole document is replaced by
   * a snapshot, since none of the in-progress state it described survives.
   */
  clearAll(): void {
    for (const clientId of [...this.#ghosts.keys()]) {
      this.remove(clientId);
    }
  }

  /**
   * Clears any ghost(s) for the given region id, regardless of which peer
   * they belong to — used on reconciliation, where the committing peer's
   * presence-observed id and their command's embedded id are not
   * guaranteed to match (see UVGhostSync). Content-based instead: at most
   * one peer sensibly drags a given region at a time.
   */
  removeByRegion(
    id: string
  ): void {
    for (const [clientId, state] of [...this.#ghosts.entries()]) {
      if (state.id === id) {
        this.remove(clientId);
      }
    }
  }

  /**
   * Re-places every active ghost — used after a pan/zoom.
   */
  refresh(): void {
    for (const clientId of this.#ghosts.keys()) {
      this.#render(clientId);
    }
  }

  destroy(): void {
    this.#ghosts.clear();
    for (const { border } of this.#borders.values()) {
      border.remove();
    }
    this.#borders.clear();
    this.#syncSuppression();
  }

  #syncSuppression(): void {
    this.#uvOverlay.setGhostSuppressed(
      this.#ghosts.values()
    );
  }

  #render(
    clientId: string
  ): void {
    const state = this.#ghosts.get(clientId);
    if (!state) {
      return;
    }

    const isTriangle = "shape" in state.geometry;
    const existing = this.#borders.get(clientId);
    if (existing && existing.isTriangle !== isTriangle) {
      existing.border.remove();
      this.#borders.delete(clientId);
    }

    const border = this.#borders.get(clientId)?.border ?? this.#createBorder(
      clientId,
      state.geometry,
      isTriangle
    );
    const style: BorderStyle = {
      color: state.color,
      strokeWidth: kStrokeWidth,
      selected: false,
      dimmed: false,
      dashed: true,
      casing: false
    };

    border.place(
      state.geometry,
      this.#viewport.zoom.value,
      this.#viewport.camera
    );
    border.paint(style);
    border.appendTo(this.#svg);
  }

  #createBorder(
    clientId: string,
    geometry: UVGeometry,
    isTriangle: boolean
  ): Border {
    const border = new Border(geometry);
    this.#borders.set(clientId, {
      border,
      isTriangle
    });

    return border;
  }
}
