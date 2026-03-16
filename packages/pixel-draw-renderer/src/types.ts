export type Vec2 = {
  x: number;
  y: number;
};

export type Mode =
  | "paint"
  | "move"
  | "uv";

export type UVHandleType =
  | "corner-tl"
  | "corner-tr"
  | "corner-bl"
  | "corner-br"
  | "edge-t"
  | "edge-b"
  | "edge-l"
  | "edge-r"
  | "body";

export interface UVHandle {
  readonly regionId: string;
  readonly type: UVHandleType;
}

export interface DefaultViewport {
  readonly zoom: number;
  readonly camera: Readonly<Vec2>;
}

export interface Brush {
  readonly size: number;
  readonly colorInline: string;
  readonly colorOutline: string;
}
