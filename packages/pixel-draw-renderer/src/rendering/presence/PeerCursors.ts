// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type {
  Vec2
} from "../../types.ts";

export interface PeerCursorState {
  pos: Vec2 | null;
  color: string;
  label?: string;
}

interface PeerCursorElements {
  group: SVGGElement;
  arrow: SVGPathElement;
  labelText: SVGTextElement;
}

// CONSTANTS
// This pointer stays screen-sized because its group is translated, not scaled.
const kArrowPath = "M0,0 L0,15.5 L3.6,12 L6.3,18.3 L8.6,17.3 L6,11.2 L11,11.2 Z";
const kLabelFontSize = 11;
const kLabelOffsetX = 13;
const kLabelOffsetY = 9;

export class PeerCursors {
  #svg: SVGElement;
  #viewport: DefaultViewport;
  #peers = new Map<string, PeerCursorState>();
  #elements = new Map<string, PeerCursorElements>();
  #defs: SVGDefsElement;
  // Per-instance ids prevent SVG filter collisions across canvases.
  #shadowFilterId = `peer-cursor-shadow-${crypto.randomUUID()}`;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport
  ) {
    this.#svg = svg;
    this.#viewport = viewport;
    this.#defs = this.#createShadowFilter();
    this.#svg.appendChild(this.#defs);
  }

  #createShadowFilter(): SVGDefsElement {
    const defs = document.createElementNS(SVG_NS, "defs");
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", this.#shadowFilterId);
    // Expand the default filter bounds so the blurred shadow is not clipped.
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    const dropShadow = document.createElementNS(
      SVG_NS,
      "feDropShadow"
    );
    dropShadow.setAttribute("dx", "0");
    dropShadow.setAttribute("dy", "1");
    dropShadow.setAttribute("stdDeviation", "1");
    dropShadow.setAttribute("flood-color", "#000000");
    dropShadow.setAttribute("flood-opacity", "0.25");
    filter.appendChild(dropShadow);

    defs.appendChild(filter);

    return defs;
  }

  set(
    clientId: string,
    state: PeerCursorState
  ): void {
    this.#peers.set(clientId, state);
    this.#render(clientId);
  }

  remove(
    clientId: string
  ): void {
    this.#peers.delete(clientId);
    this.#elements.get(
      clientId
    )?.group.remove();
    this.#elements.delete(clientId);
  }

  refresh(): void {
    for (const clientId of this.#peers.keys()) {
      this.#render(clientId);
    }
  }

  destroy(): void {
    for (const elements of this.#elements.values()) {
      elements.group.remove();
    }

    this.#peers.clear();
    this.#elements.clear();
    this.#defs.remove();
  }

  #render(
    clientId: string
  ): void {
    const state = this.#peers.get(clientId);
    if (!state) {
      return;
    }

    if (!state.pos) {
      this.#elements.get(
        clientId
      )?.group.setAttribute("visibility", "hidden");

      return;
    }

    const elements = this.#elements.get(
      clientId
    ) ?? this.#createElements(clientId);
    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;
    const x = state.pos.x * zoom + camera.x;
    const y = state.pos.y * zoom + camera.y;

    elements.group.setAttribute("visibility", "visible");
    elements.group.setAttribute(
      "transform",
      `translate(${x}, ${y})`
    );
    elements.arrow.setAttribute("fill", state.color);
    elements.labelText.setAttribute("fill", state.color);
    elements.labelText.textContent = state.label ?? "";
  }

  #createElements(
    clientId: string
  ): PeerCursorElements {
    const group = document.createElementNS(SVG_NS, "g");
    Object.assign(group.style, {
      pointerEvents: "none"
    });
    group.setAttribute(
      "filter",
      `url(#${this.#shadowFilterId})`
    );

    const arrow = document.createElementNS(SVG_NS, "path");
    arrow.setAttribute("d", kArrowPath);
    arrow.setAttribute("stroke", "#ffffff");
    arrow.setAttribute("stroke-width", "1");
    group.appendChild(arrow);

    // A white paint-order stroke keeps labels legible over similar colors.
    const labelText = document.createElementNS(SVG_NS, "text");
    labelText.setAttribute("x", String(kLabelOffsetX));
    labelText.setAttribute("y", String(kLabelOffsetY));
    labelText.setAttribute("font-size", String(kLabelFontSize));
    labelText.setAttribute("paint-order", "stroke");
    labelText.setAttribute("stroke", "#ffffff");
    labelText.setAttribute("stroke-width", "3");
    labelText.setAttribute("stroke-linejoin", "round");
    group.appendChild(labelText);

    this.#svg.appendChild(group);
    const elements: PeerCursorElements = {
      group,
      arrow,
      labelText
    };
    this.#elements.set(clientId, elements);

    return elements;
  }
}
