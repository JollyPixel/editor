export type ResizeDirection =
  | "left"
  | "right"
  | "top"
  | "bottom";
export type ResizeCoordinate =
  | "clientX"
  | "clientY";
export type ResizeDimension =
  | "width"
  | "height";
export type ResizeOrientation =
  | "horizontal"
  | "vertical";
export type ResizeKey =
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp";

export interface ResizeDirectionDefinition {
  readonly coordinate: ResizeCoordinate;
  readonly dimension: ResizeDimension;
  readonly fromStart: boolean;
  readonly growKey: ResizeKey;
  readonly orientation: ResizeOrientation;
  readonly shrinkKey: ResizeKey;
}

export const RESIZE_DIRECTIONS = {
  left: {
    coordinate: "clientX",
    dimension: "width",
    fromStart: true,
    growKey: "ArrowRight",
    orientation: "vertical",
    shrinkKey: "ArrowLeft"
  },
  right: {
    coordinate: "clientX",
    dimension: "width",
    fromStart: false,
    growKey: "ArrowLeft",
    orientation: "vertical",
    shrinkKey: "ArrowRight"
  },
  top: {
    coordinate: "clientY",
    dimension: "height",
    fromStart: true,
    growKey: "ArrowDown",
    orientation: "horizontal",
    shrinkKey: "ArrowUp"
  },
  bottom: {
    coordinate: "clientY",
    dimension: "height",
    fromStart: false,
    growKey: "ArrowUp",
    orientation: "horizontal",
    shrinkKey: "ArrowDown"
  }
} as const satisfies Record<ResizeDirection, ResizeDirectionDefinition>;

export function coordinateFromKey(
  definition: ResizeDirectionDefinition,
  key: string,
  step: number
): number | null {
  switch (key) {
    case definition.growKey:
      return definition.fromStart ? step : -step;
    case definition.shrinkKey:
      return definition.fromStart ? -step : step;
    default:
      return null;
  }
}
