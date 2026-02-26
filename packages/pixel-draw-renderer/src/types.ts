export type Vec2 = {
  x: number;
  y: number;
};

export type Mode = "paint" | "move";

export interface DefaultViewport {
  readonly zoom: number;
  readonly camera: Readonly<Vec2>;
}

export interface Brush {
  readonly size: number;
  readonly colorInline: string;
  readonly colorOutline: string;
}
