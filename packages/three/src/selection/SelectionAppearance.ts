// Import Third-party Dependencies
import * as THREE from "three";

export interface SelectionIndicatorAppearanceOptions {
  color?: THREE.ColorRepresentation;
  opacity?: number;
}

export interface SelectionOutlineAppearanceOptions {
  linewidth?: number;
}

export interface SelectionBoundsAppearanceOptions {
  fillOpacity?: number;
}

export interface SelectionHighlightAppearanceOptions {
  edgeThickness?: number;
  edgeGlow?: number;
  downSampleRatio?: number;
}

export interface SelectionHighlightJfaAppearanceOptions {
  ringThickness?: number;
  borderThickness?: number;
  isolatedFillOpacity?: number;
}

export interface SelectionAppearanceOptions {
  selected?: SelectionIndicatorAppearanceOptions;
  hovered?: SelectionIndicatorAppearanceOptions;
  outline?: SelectionOutlineAppearanceOptions;
  bounds?: SelectionBoundsAppearanceOptions;
  highlight?: SelectionHighlightAppearanceOptions;
  highlightJfa?: SelectionHighlightJfaAppearanceOptions;
  xray?: boolean;
}

export interface SelectionIndicatorAppearance {
  readonly color: THREE.ColorRepresentation;
  readonly opacity: number;
}

export interface SelectionOutlineAppearance {
  readonly linewidth: number;
}

export interface SelectionBoundsAppearance {
  readonly fillOpacity: number;
}

export interface SelectionHighlightAppearance {
  readonly edgeThickness: number;
  readonly edgeGlow: number;
  readonly downSampleRatio: number;
}

export interface SelectionHighlightJfaAppearance {
  readonly ringThickness: number;
  readonly borderThickness: number;
  readonly isolatedFillOpacity: number;
}

/**
 * Immutable visual configuration shared by every selection renderer.
 */
export class SelectionAppearance {
  readonly selected: SelectionIndicatorAppearance;
  readonly hovered: SelectionIndicatorAppearance;
  readonly outline: SelectionOutlineAppearance;
  readonly bounds: SelectionBoundsAppearance;
  readonly highlight: SelectionHighlightAppearance;
  readonly highlightJfa: SelectionHighlightJfaAppearance;
  readonly xray: boolean;

  constructor(
    options: SelectionAppearanceOptions = {}
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

    Object.freeze(this);
  }

  with(
    options: SelectionAppearanceOptions
  ): SelectionAppearance {
    return new SelectionAppearance({
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
      xray: options.xray ?? this.xray
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
    throw new RangeError("Selection opacity must be finite");
  }

  return THREE.MathUtils.clamp(value, 0, 1);
}

function positive(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Selection ${label} must be greater than zero`);
  }

  return value;
}

function nonNegative(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Selection ${label} cannot be negative`);
  }

  return value;
}
