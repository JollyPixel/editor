// Import Third-party Dependencies
import * as THREE from "three";

export interface HighlightIndicatorAppearanceOptions {
  color?: THREE.ColorRepresentation;
  opacity?: number;
}

export interface HighlightOutlineAppearanceOptions {
  linewidth?: number;
}

export interface HighlightBoundsAppearanceOptions {
  fillOpacity?: number;
}

export interface HighlightPassAppearanceOptions {
  edgeThickness?: number;
  edgeGlow?: number;
  downSampleRatio?: number;
}

export interface HighlightPassJfaAppearanceOptions {
  ringThickness?: number;
  borderThickness?: number;
  isolatedFillOpacity?: number;
}

export interface MeshHighlightAppearanceOptions {
  selected?: HighlightIndicatorAppearanceOptions;
  hovered?: HighlightIndicatorAppearanceOptions;
  outline?: HighlightOutlineAppearanceOptions;
  bounds?: HighlightBoundsAppearanceOptions;
  highlight?: HighlightPassAppearanceOptions;
  highlightJfa?: HighlightPassJfaAppearanceOptions;
  xray?: boolean;
  /**
   * Multiplies any indicator's opacity for the portion hidden behind other
   * geometry, when xray is enabled and the technique supports it. Leave
   * unset to draw the hidden portion at the same opacity as the visible one.
   */
  occludedOpacityScale?: number;
}

export interface HighlightIndicatorAppearance {
  readonly color: THREE.ColorRepresentation;
  readonly opacity: number;
}

export interface HighlightOutlineAppearance {
  readonly linewidth: number;
}

export interface HighlightBoundsAppearance {
  readonly fillOpacity: number;
}

export interface HighlightPassAppearance {
  readonly edgeThickness: number;
  readonly edgeGlow: number;
  readonly downSampleRatio: number;
}

export interface HighlightPassJfaAppearance {
  readonly ringThickness: number;
  readonly borderThickness: number;
  readonly isolatedFillOpacity: number;
}

/**
 * Immutable visual configuration shared by every selection renderer.
 */
export class MeshHighlightAppearance {
  readonly selected: HighlightIndicatorAppearance;
  readonly hovered: HighlightIndicatorAppearance;
  readonly outline: HighlightOutlineAppearance;
  readonly bounds: HighlightBoundsAppearance;
  readonly highlight: HighlightPassAppearance;
  readonly highlightJfa: HighlightPassJfaAppearance;
  readonly xray: boolean;
  readonly occludedOpacityScale: number | null;

  constructor(
    options: MeshHighlightAppearanceOptions = {}
  ) {
    this.selected = Object.freeze({
      color: copyColor(options.selected?.color ?? "#ffffff"),
      opacity: normalizedOpacity(options.selected?.opacity ?? 1)
    });
    this.hovered = Object.freeze({
      color: copyColor(options.hovered?.color ?? "#8ab4f8"),
      opacity: normalizedOpacity(options.hovered?.opacity ?? 0.35)
    });
    this.outline = Object.freeze({
      linewidth: positive(options.outline?.linewidth ?? 1, "outline.linewidth")
    });
    this.bounds = Object.freeze({
      fillOpacity: normalizedOpacity(options.bounds?.fillOpacity ?? 0)
    });
    this.highlight = Object.freeze({
      edgeThickness: positive(
        options.highlight?.edgeThickness ?? 1,
        "highlight.edgeThickness"
      ),
      edgeGlow: nonNegative(
        options.highlight?.edgeGlow ?? 0,
        "highlight.edgeGlow"
      ),
      downSampleRatio: positive(
        options.highlight?.downSampleRatio ?? 2,
        "highlight.downSampleRatio"
      )
    });
    this.highlightJfa = Object.freeze({
      ringThickness: positive(
        options.highlightJfa?.ringThickness ?? 2,
        "highlightJfa.ringThickness"
      ),
      borderThickness: nonNegative(
        options.highlightJfa?.borderThickness ?? 1,
        "highlightJfa.borderThickness"
      ),
      isolatedFillOpacity: normalizedOpacity(
        options.highlightJfa?.isolatedFillOpacity ?? 0.15
      )
    });
    this.xray = options.xray ?? false;
    this.occludedOpacityScale = options.occludedOpacityScale === undefined ?
      null :
      normalizedOpacity(options.occludedOpacityScale);

    Object.freeze(this);
  }

  with(
    options: MeshHighlightAppearanceOptions
  ): MeshHighlightAppearance {
    return new MeshHighlightAppearance({
      selected: {
        ...this.selected,
        ...options.selected
      },
      hovered: {
        ...this.hovered,
        ...options.hovered
      },
      outline: {
        ...this.outline,
        ...options.outline
      },
      bounds: {
        ...this.bounds,
        ...options.bounds
      },
      highlight: {
        ...this.highlight,
        ...options.highlight
      },
      highlightJfa: {
        ...this.highlightJfa,
        ...options.highlightJfa
      },
      xray: options.xray ?? this.xray,
      occludedOpacityScale: options.occludedOpacityScale ?? this.occludedOpacityScale ?? undefined
    });
  }
}

function copyColor(
  color: THREE.ColorRepresentation
): THREE.ColorRepresentation {
  return color instanceof THREE.Color ? Object.freeze(color.clone()) : color;
}

function normalizedOpacity(
  value: number
): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Highlight opacity must be finite");
  }

  return THREE.MathUtils.clamp(value, 0, 1);
}

function positive(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Highlight ${label} must be greater than zero`);
  }

  return value;
}

function nonNegative(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Highlight ${label} cannot be negative`);
  }

  return value;
}
