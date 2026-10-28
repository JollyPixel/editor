// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

export type UIAnchorX = "left" | "center" | "right";
export type UIAnchorY = "top" | "center" | "bottom";

export interface UIBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface UISize {
  width: number;
  height: number;
}

export interface UINodePositionalOptions {
  anchor?: {
    x?: UIAnchorX;
    y?: UIAnchorY;
  };
  offset?: {
    x?: number;
    y?: number;
  };
}

export interface UINodeOptions extends UINodePositionalOptions {
  /**
   * Size of the UI element in world units.
   * @default 0
   */
  size?: {
    width?: number;
    height?: number;
  };
  /**
   * Normalized origin point of the element (0 to 1).
   * - `{ x: 0, y: 0 }` → bottom-left corner
   * - `{ x: 0.5, y: 0.5 }` → center (default)
   * - `{ x: 1, y: 1 }` → top-right corner
   */
  pivot?: {
    x?: number;
    y?: number;
  };
}

type AxisAnchor = "start" | "center" | "end";

// CONSTANTS
const kAxisX: Readonly<Record<UIAnchorX, AxisAnchor>> = {
  left: "start",
  center: "center",
  right: "end"
};
const kAxisY: Readonly<Record<UIAnchorY, AxisAnchor>> = {
  bottom: "start",
  center: "center",
  top: "end"
};

export class UILayout {
  readonly size: Readonly<UISize>;
  readonly pivot: Readonly<THREE.Vector2Like>;
  readonly anchor: Readonly<{ x: UIAnchorX; y: UIAnchorY; }>;
  readonly offset: Readonly<THREE.Vector2Like>;

  constructor(
    options: UINodeOptions = {}
  ) {
    const {
      size = {},
      pivot = {},
      anchor = {},
      offset = {}
    } = options;

    this.size = Object.freeze({
      width: size.width ?? 0,
      height: size.height ?? 0
    });
    this.pivot = Object.freeze({
      x: pivot.x ?? 0.5,
      y: pivot.y ?? 0.5
    });
    this.anchor = Object.freeze({
      x: anchor.x ?? "center",
      y: anchor.y ?? "center"
    });
    this.offset = Object.freeze({
      x: offset.x ?? 0,
      y: offset.y ?? 0
    });
  }

  position(
    bounds: Readonly<UIBounds>
  ): THREE.Vector2Like {
    return {
      x: place(
        kAxisX[this.anchor.x],
        bounds.left,
        bounds.right,
        this.size.width,
        this.pivot.x
      ) + this.offset.x,
      y: place(
        kAxisY[this.anchor.y],
        bounds.bottom,
        bounds.top,
        this.size.height,
        this.pivot.y
      ) + this.offset.y
    };
  }
}

function place(
  anchor: AxisAnchor,
  start: number,
  end: number,
  size: number,
  pivot: number
): number {
  switch (anchor) {
    case "start":
      return start + (size * (1 - pivot));
    case "end":
      return end - (size * pivot);
    case "center":
      return size * (0.5 - pivot);
  }
}
