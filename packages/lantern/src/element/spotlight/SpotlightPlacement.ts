// Import Third-party Dependencies
import {
  anchoredPosition,
  type AnchorRect,
  type ViewportPosition,
  type ViewportSize
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { StepSide } from "../../tour/TourStep.ts";
import type { CornerRadii } from "./CornerRadii.ts";
import { Hole } from "./Hole.ts";

// CONSTANTS
const kHolePadding = 6;
const kCardGap = 10;

export interface TargetAnchor {
  rect: AnchorRect;
  radii: CornerRadii;
}

export interface SpotlightView {
  viewport: ViewportSize;
  card: ViewportSize;
  side: StepSide;
}

export interface SpotlightParts {
  scrim: HTMLElement;
  ring: HTMLElement;
  card: HTMLElement;
}

export interface SpotlightPlacementOptions {
  hole: Hole;
  lit: boolean;
  card: ViewportPosition;
  viewport: ViewportSize;
}

export class SpotlightPlacement {
  static centred(
    view: SpotlightView
  ): SpotlightPlacement {
    const { viewport, card } = view;

    return new SpotlightPlacement({
      hole: Hole.atCentre(viewport),
      lit: false,
      card: {
        x: (viewport.width - card.width) / 2,
        y: (viewport.height - card.height) / 2
      },
      viewport
    });
  }

  static around(
    anchor: TargetAnchor,
    view: SpotlightView
  ): SpotlightPlacement {
    const { viewport, card, side } = view;
    const hole = Hole.around(anchor.rect, anchor.radii, viewport, kHolePadding);

    return new SpotlightPlacement({
      hole,
      lit: true,
      card: anchoredPosition({
        anchor: hole.toAnchorRect(),
        panel: card,
        viewport,
        gap: kCardGap,
        side,
        align: "center"
      }),
      viewport
    });
  }

  readonly hole: Hole;
  readonly lit: boolean;
  readonly card: ViewportPosition;
  readonly viewport: ViewportSize;

  constructor(
    options: SpotlightPlacementOptions
  ) {
    this.hole = options.hole;
    this.lit = options.lit;
    this.card = {
      x: options.card.x,
      y: options.card.y
    };
    this.viewport = {
      width: options.viewport.width,
      height: options.viewport.height
    };
  }

  equals(
    other: SpotlightPlacement
  ): boolean {
    return other.lit === this.lit &&
      other.hole.equals(this.hole) &&
      other.card.x === this.card.x &&
      other.card.y === this.card.y &&
      other.viewport.width === this.viewport.width &&
      other.viewport.height === this.viewport.height;
  }

  paint(
    parts: SpotlightParts
  ): void {
    const { hole, card } = this;

    parts.scrim.style.clipPath = hole.clipPath(this.viewport);
    parts.ring.hidden = !this.lit;
    parts.ring.style.transform = `translate(${hole.x}px, ${hole.y}px)`;
    parts.ring.style.width = `${hole.width}px`;
    parts.ring.style.height = `${hole.height}px`;
    parts.ring.style.borderRadius = hole.radii.toBorderRadius();
    parts.card.style.transform = `translate(${card.x}px, ${card.y}px)`;
  }
}
