// Import Internal Dependencies
import { PointerResize } from "./PointerResize.ts";
import { ResizeBounds } from "./ResizeBounds.ts";
import {
  coordinateFromKey,
  RESIZE_DIRECTIONS,
  type ResizeDirection,
  type ResizeDirectionDefinition
} from "./ResizeDirection.ts";
import { sizeFromDelta } from "./utils.ts";

// CONSTANTS
const kKeyboardStep = 8;
const kKeyboardCoarseStep = 32;

export interface ResizeHandleOptions {
  /**
   * The direction in which the handle resizes the target element.
   */
  direction: ResizeDirection;
  /**
   * Whether double-clicking collapses and restores the target.
   * @default false
   */
  collapsible?: boolean;
  /**
   * An existing handle. When omitted, a sibling div is reused or created.
   */
  handle?: HTMLElement;
  /**
   * Smallest target size in pixels.
   * @default 0
   */
  minSize?: number;
  /**
   * Largest target size in pixels.
   * @default Number.POSITIVE_INFINITY
   */
  maxSize?: number;
}

/**
 * Resizes a target element through pointer and keyboard input.
 */
export class ResizeHandle extends EventTarget {
  #handleElt: HTMLElement;
  #targetElt: HTMLElement;
  #direction: ResizeDirection;
  #definition: ResizeDirectionDefinition;
  #bounds: ResizeBounds;
  #pointerResize: PointerResize;
  #injectedHandle: boolean;
  #savedSize: number | null = null;
  #initialSize = 0;
  #startDrag = 0;
  #disposed = false;

  get handleElt(): HTMLElement {
    return this.#handleElt;
  }

  get targetElt(): HTMLElement {
    return this.#targetElt;
  }

  get direction(): ResizeDirection {
    return this.#direction;
  }

  constructor(
    targetElt: HTMLElement,
    options: ResizeHandleOptions
  ) {
    super();

    const {
      direction,
      handle,
      minSize,
      maxSize
    } = options;
    const definition = RESIZE_DIRECTIONS[direction];
    if (definition === undefined) {
      throw new Error(`Invalid direction: "${direction}"`);
    }

    this.#direction = direction;
    this.#definition = definition;
    this.#bounds = new ResizeBounds(minSize, maxSize);
    this.#targetElt = targetElt;

    const resolved = this.#resolveHandle(handle);
    this.#handleElt = resolved.element;
    this.#injectedHandle = resolved.injected;
    this.#configureHandle(options.collapsible ?? false);
    this.#handleElt.addEventListener(
      "dblclick",
      this.#onDoubleClick
    );
    this.#handleElt.addEventListener(
      "keydown",
      this.#onKeyDown
    );
    this.#pointerResize = new PointerResize({
      handle: this.#handleElt,
      definition: this.#definition,
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
    this.#handleElt.removeEventListener(
      "dblclick",
      this.#onDoubleClick
    );
    this.#handleElt.removeEventListener(
      "keydown",
      this.#onKeyDown
    );

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

    const candidateElt = this.#definition.fromStart
      ? this.#targetElt.nextElementSibling
      : this.#targetElt.previousElementSibling;

    if (
      candidateElt instanceof HTMLDivElement &&
      candidateElt.classList.contains("resize-handle")
    ) {
      return {
        element: candidateElt,
        injected: false
      };
    }

    const element = document.createElement("div");
    this.#targetElt.parentNode!.insertBefore(
      element,
      this.#definition.fromStart
        ? this.#targetElt.nextSibling
        : this.#targetElt
    );

    return {
      element,
      injected: true
    };
  }

  #configureHandle(
    collapsible: boolean
  ): void {
    this.#handleElt.classList.add(
      "resize-handle",
      this.#direction
    );
    this.#handleElt.classList.toggle(
      "collapsible",
      collapsible
    );
    this.#handleElt.setAttribute("role", "separator");
    this.#handleElt.setAttribute(
      "aria-orientation",
      this.#definition.orientation
    );
    this.#handleElt.setAttribute(
      "aria-valuemin",
      String(this.#bounds.min)
    );
    if (this.#bounds.hasMaximum) {
      this.#handleElt.setAttribute(
        "aria-valuemax",
        String(this.#bounds.max)
      );
    }
    else {
      this.#handleElt.removeAttribute("aria-valuemax");
    }
    if (!this.#handleElt.hasAttribute("tabindex")) {
      this.#handleElt.tabIndex = 0;
    }
    this.#updateAriaValue();
  }

  #onDoubleClick = (
    event: MouseEvent
  ) => {
    if (
      event.button !== 0 ||
      !this.#handleElt.classList.contains("collapsible")
    ) {
      return;
    }

    const size = this.#readSize();
    let newSize: number;
    if (size > 0) {
      this.#savedSize = size;
      newSize = 0;
      this.#targetElt.style.display = "none";
    }
    else {
      newSize = this.#bounds.clamp(this.#savedSize ?? 0);
      this.#savedSize = null;
      this.#targetElt.style.display = "";
    }

    this.#writeSize(newSize);
  };

  #onKeyDown = (
    event: KeyboardEvent
  ) => {
    if (!this.#canInteract()) {
      return;
    }

    const coordinate = coordinateFromKey(
      this.#definition,
      event.key,
      event.shiftKey ? kKeyboardCoarseStep : kKeyboardStep
    );
    if (coordinate === null) {
      return;
    }

    event.preventDefault();
    const size = this.#sizeFromCoordinate(
      this.#readSize(),
      0,
      coordinate
    );

    this.dispatchEvent(new Event("dragStart"));
    this.#writeSize(size);
    this.dispatchEvent(new Event("drag"));
    this.dispatchEvent(new Event("dragEnd"));
  };

  #onPointerStart = (
    coordinate: number
  ) => {
    this.#initialSize = this.#readSize();
    this.#startDrag = coordinate;
    this.dispatchEvent(new Event("dragStart"));
  };

  #onPointerMove = (
    coordinate: number
  ) => {
    this.#writeSize(this.#sizeFromCoordinate(
      this.#initialSize,
      this.#startDrag,
      coordinate
    ));
    this.dispatchEvent(new Event("drag"));
  };

  #onPointerEnd = () => {
    this.dispatchEvent(new Event("dragEnd"));
  };

  #canInteract = (): boolean => !this.#disposed &&
    this.#targetElt.style.display !== "none" &&
    !this.#handleElt.classList.contains("disabled");

  #sizeFromCoordinate(
    initialSize: number,
    startDrag: number,
    current: number
  ): number {
    return sizeFromDelta({
      initialSize,
      startDrag,
      current,
      fromStart: this.#definition.fromStart,
      min: this.#bounds.min,
      max: this.#bounds.max
    });
  }

  #readSize(): number {
    const rect = this.#targetElt.getBoundingClientRect();

    return rect[this.#definition.dimension];
  }

  #writeSize(
    size: number
  ): void {
    this.#targetElt.style[this.#definition.dimension] = `${size}px`;
    this.#handleElt.setAttribute(
      "aria-valuenow",
      String(size)
    );
  }

  #updateAriaValue(): void {
    this.#handleElt.setAttribute(
      "aria-valuenow",
      String(this.#readSize())
    );
  }
}
