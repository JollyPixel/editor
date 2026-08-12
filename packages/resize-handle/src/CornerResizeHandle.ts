// Import Internal Dependencies
import {
  PointerResize,
  type PointerCoordinate
} from "./PointerResize.ts";
import { ResizeBounds } from "./ResizeBounds.ts";
import {
  RESIZE_DIRECTIONS,
  type ResizeDirectionDefinition
} from "./ResizeDirection.ts";
import type { ResizeHandleLike } from "./ResizeHandleLike.ts";
import { sizeFromDelta } from "./utils.ts";

export interface CornerResizeHandleOptions {
  /**
   * Anchor edge for the width axis
   */
  horizontal: "left" | "right";
  /**
   * Anchor edge for the height axis
   */
  vertical: "top" | "bottom";
  /**
   * An existing handle. When omitted, a div is appended to the target.
   */
  handle?: HTMLElement;
  /**
   * Smallest target width in pixels.
   * @default 0
   */
  minWidth?: number;
  /**
   * Largest target width in pixels.
   * @default Number.POSITIVE_INFINITY
   */
  maxWidth?: number;
  /**
   * Smallest target height in pixels.
   * @default 0
   */
  minHeight?: number;
  /**
   * Largest target height in pixels.
   * @default Number.POSITIVE_INFINITY
   */
  maxHeight?: number;
}

/**
 * Resizes a target element on both axes at once from a single pointer drag.
 */
export class CornerResizeHandle extends EventTarget implements ResizeHandleLike {
  #handleElt: HTMLElement;
  #targetElt: HTMLElement;
  #horizontal: ResizeDirectionDefinition;
  #vertical: ResizeDirectionDefinition;
  #widthBounds: ResizeBounds;
  #heightBounds: ResizeBounds;
  #pointerResize: PointerResize;
  #injectedHandle: boolean;
  #initialWidth = 0;
  #initialHeight = 0;
  #startDrag: PointerCoordinate = {
    x: 0,
    y: 0
  };
  #disposed = false;

  get handleElt(): HTMLElement {
    return this.#handleElt;
  }

  get targetElt(): HTMLElement {
    return this.#targetElt;
  }

  constructor(
    targetElt: HTMLElement,
    options: CornerResizeHandleOptions
  ) {
    super();

    const {
      horizontal,
      vertical,
      handle,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight
    } = options;

    this.#horizontal = RESIZE_DIRECTIONS[horizontal];
    this.#vertical = RESIZE_DIRECTIONS[vertical];
    this.#widthBounds = new ResizeBounds(
      minWidth,
      maxWidth
    );
    this.#heightBounds = new ResizeBounds(
      minHeight,
      maxHeight
    );
    this.#targetElt = targetElt;

    const resolved = this.#resolveHandle(handle);
    this.#handleElt = resolved.element;
    this.#injectedHandle = resolved.injected;
    this.#configureHandle(horizontal, vertical);

    this.#pointerResize = new PointerResize({
      handle: this.#handleElt,
      // nwse/nesw follows the resulting visual corner: top-left and
      // bottom-right share nwse, top-right and bottom-left share nesw.
      dragToken: (horizontal === "right") === (vertical === "bottom") ?
        "nwse" :
        "nesw",
      canStart: this.#canInteract,
      onStart: this.#onPointerStart,
      onMove: this.#onPointerMove,
      onEnd: this.#onPointerEnd
    });
  }

  /**
   * Stops interaction and removes a handle created by this instance.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#pointerResize.dispose();

    if (this.#injectedHandle) {
      this.#handleElt.remove();
    }
  }

  #resolveHandle(
    supplied: HTMLElement | undefined
  ): { element: HTMLElement; injected: boolean; } {
    if (supplied !== undefined) {
      return {
        element: supplied,
        injected: false
      };
    }

    const element = document.createElement("div");
    this.#targetElt.appendChild(element);

    return {
      element,
      injected: true
    };
  }

  #configureHandle(
    horizontal: "left" | "right",
    vertical: "top" | "bottom"
  ): void {
    // The class names the corner the handle visually sits at, which is the
    // side opposite each anchor edge.
    const visualHorizontal = horizontal === "left" ?
      "right" :
      "left";
    const visualVertical = vertical === "top" ?
      "bottom" :
      "top";

    this.#handleElt.classList.add(
      "resize-handle",
      "corner",
      `${visualVertical}-${visualHorizontal}`
    );
    this.#handleElt.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  #onPointerStart = (
    coordinate: PointerCoordinate
  ) => {
    this.#initialWidth = this.#readWidth();
    this.#initialHeight = this.#readHeight();
    this.#startDrag = coordinate;
    this.dispatchEvent(
      new Event("dragStart")
    );
  };

  #onPointerMove = (
    coordinate: PointerCoordinate
  ) => {
    const width = sizeFromDelta({
      initialSize: this.#initialWidth,
      startDrag: this.#startDrag.x,
      current: coordinate.x,
      fromStart: this.#horizontal.fromStart,
      min: this.#widthBounds.min,
      max: this.#widthBounds.max
    });
    const height = sizeFromDelta({
      initialSize: this.#initialHeight,
      startDrag: this.#startDrag.y,
      current: coordinate.y,
      fromStart: this.#vertical.fromStart,
      min: this.#heightBounds.min,
      max: this.#heightBounds.max
    });

    this.#targetElt.style.width = `${width}px`;
    this.#targetElt.style.height = `${height}px`;
    this.dispatchEvent(
      new Event("drag")
    );
  };

  #onPointerEnd = () => {
    this.dispatchEvent(
      new Event("dragEnd")
    );
  };

  #canInteract = (): boolean => !this.#disposed &&
    this.#targetElt.style.display !== "none" &&
    !this.#handleElt.classList.contains("disabled");

  #readWidth(): number {
    return this.#targetElt.getBoundingClientRect().width;
  }

  #readHeight(): number {
    return this.#targetElt.getBoundingClientRect().height;
  }
}
