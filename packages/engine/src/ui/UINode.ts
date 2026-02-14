// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type Actor, ActorComponent } from "../actor/index.ts";
import type { UIRenderer } from "./UIRenderer.ts";

export type UIAnchorX = "left" | "center" | "right";
export type UIAnchorY = "top" | "center" | "bottom";

interface ComputeXParams {
  anchor: UIAnchorX;
  bounds: { left: number; right: number; };
  offset: number;
  width: number;
  pivotX: number;
}

interface ComputeYParams {
  anchor: UIAnchorY;
  bounds: { top: number; bottom: number; };
  offset: number;
  height: number;
  pivotY: number;
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

export class UINode extends ActorComponent {
  #options: UINodeOptions;

  constructor(
    actor: Actor,
    options: UINodeOptions = {}
  ) {
    super({ actor, typeName: "UINode" });
    this.#options = options;

    const uiRenderer = this.actor.gameInstance[Symbol.for("UIRenderer")] as UIRenderer;
    if (uiRenderer) {
      uiRenderer.addChildren(this);
    }
    else {
      this.updateToWorldPosition();
      this.actor.gameInstance.renderer.on(
        "resize", this.updateToWorldPosition.bind(this)
      );
    }
  }

  get size() {
    return {
      width: this.#options.size?.width ?? 0,
      height: this.#options.size?.height ?? 0
    };
  }

  get pivot(): THREE.Vector2Like {
    return {
      x: this.#options.pivot?.x ?? 0.5,
      y: this.#options.pivot?.y ?? 0.5
    };
  }

  addChildren(
    object: THREE.Object3D
  ): void {
    this.actor.threeObject.add(object);
  }

  updateToWorldPosition(): void {
    const {
      offset = { x: 0, y: 0 },
      anchor = { x: "center", y: "center" }
    } = this.#options;

    const screenBounds = this.actor.gameInstance.input.getScreenBounds();

    const { width, height } = this.size;
    const pivot = this.pivot;

    const x = this.#computeX({
      anchor: anchor.x ?? "center",
      bounds: screenBounds,
      offset: offset.x ?? 0,
      width,
      pivotX: pivot.x
    });
    const y = this.#computeY({
      anchor: anchor.y ?? "center",
      bounds: screenBounds,
      offset: offset.y ?? 0,
      height,
      pivotY: pivot.y
    });

    this.actor.threeObject.position.set(x, y, 0);
  }

  #computeX(
    params: ComputeXParams
  ): number {
    const { anchor, bounds, offset, width, pivotX } = params;

    // Shift so the pivot-aligned edge sits at the anchor
    const pivotShift = width * (0.5 - pivotX);

    switch (anchor) {
      case "left":
        return bounds.left + (width * (1 - pivotX)) + offset;
      case "right":
        return bounds.right - (width * pivotX) + offset;
      case "center":
        return pivotShift + offset;
      default:
        return pivotShift + offset;
    }
  }

  #computeY(
    params: ComputeYParams
  ): number {
    const { anchor, bounds, offset, height, pivotY } = params;

    // Shift so the pivot-aligned edge sits at the anchor
    const pivotShift = height * (0.5 - pivotY);

    switch (anchor) {
      case "top":
        return bounds.top - (height * pivotY) + offset;
      case "bottom":
        return bounds.bottom + (height * (1 - pivotY)) + offset;
      case "center":
        return pivotShift + offset;
      default:
        return pivotShift + offset;
    }
  }
}
