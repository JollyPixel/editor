export type EventInput = Event & {
  target: HTMLInputElement;
};
export type EventCanvasHoverChange = CustomEvent<{ hovering: boolean; }>;

/**
 * Two-axis counterpart to `@jolly-pixel/ui`'s `Vec3Like`, which the package
 * does not export.
 */
export interface Vec2Like {
  readonly x: number;
  readonly y: number;
}
