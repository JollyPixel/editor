// CONSTANTS
const kValidDirections = ["left", "right", "top", "bottom"] as const;

export type ResizeDirection = typeof kValidDirections[number];

export interface ResizeHandleOptions {
  /**
   * The direction in which the handle should resize the target element.
   * Must be one of "left", "right", "top", or "bottom".
   */
  direction: ResizeDirection;
  /**
   * Whether the handle should support collapsing the target element by double-clicking on it.
   * @default false
   */
  collapsable?: boolean;
}

/**
 * A class that creates a resize handle for a target element,
 * allowing the user to resize it by dragging the handle.
 */
export class ResizeHandle extends EventTarget {
  #handleElt: HTMLDivElement;
  #targetElt: HTMLElement;
  #direction: ResizeDirection;
  #horizontal: boolean;
  #start: boolean;
  #savedSize: number | null = null;

  get handleElt(): HTMLDivElement {
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

    const { direction } = options;

    if (!kValidDirections.includes(direction)) {
      throw new Error(`Invalid direction: "${direction}"`);
    }

    this.#horizontal = direction === "left" || direction === "right";
    this.#start = direction === "left" || direction === "top";
    this.#direction = direction;
    this.#targetElt = targetElt;

    const candidateElt = this.#start
      ? targetElt.nextElementSibling
      : targetElt.previousElementSibling;

    if (
      candidateElt instanceof HTMLDivElement &&
      candidateElt.classList.contains("resize-handle")
    ) {
      this.#handleElt = candidateElt;
    }
    else {
      this.#handleElt = document.createElement("div");
      this.#handleElt.classList.add("resize-handle");

      targetElt.parentNode!.insertBefore(
        this.#handleElt,
        this.#start ? targetElt.nextSibling : targetElt
      );
    }

    this.#handleElt.classList.add(direction);
    this.#handleElt.classList.toggle(
      "collapsable",
      options.collapsable ?? false
    );

    this.#handleElt.addEventListener("dblclick", this.#onDoubleClick);
    this.#handleElt.addEventListener("pointerdown", this.#onPointerDown);
  }

  #onDoubleClick = (
    event: MouseEvent
  ) => {
    if (
      event.button !== 0 ||
      !this.#handleElt.classList.contains("collapsable")
    ) {
      return;
    }

    const rect = this.#targetElt.getBoundingClientRect();
    const size = this.#horizontal ?
      rect.width :
      rect.height;

    let newSize: number;
    if (size > 0) {
      this.#savedSize = size;
      newSize = 0;
      this.#targetElt.style.display = "none";
    }
    else {
      newSize = this.#savedSize ?? 0;
      this.#savedSize = null;
      this.#targetElt.style.display = "";
    }

    this.#targetElt.style[this.#horizontal ? "width" : "height"] = `${newSize}px`;
  };

  #onPointerDown = (
    event: PointerEvent
  ) => {
    if (event.button !== 0) {
      return;
    }
    if (this.#targetElt.style.display === "none") {
      return;
    }
    if (this.#handleElt.classList.contains("disabled")) {
      return;
    }
    event.preventDefault();

    this.#handleElt.setPointerCapture(event.pointerId);
    this.dispatchEvent(new Event("dragStart"));

    const rect = this.#targetElt.getBoundingClientRect();
    const initialSize = this.#horizontal ? rect.width : rect.height;
    const startDrag = this.#horizontal ? event.clientX : event.clientY;
    const directionClass = this.#horizontal ? "vertical" : "horizontal";

    document.documentElement.classList.add("handle-dragging", directionClass);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = this.#horizontal ?
        moveEvent.clientX :
        moveEvent.clientY;
      const size = initialSize + (
        this.#start ? delta - startDrag : startDrag - delta
      );

      this.#targetElt.style[this.#horizontal ? "width" : "height"] = `${size}px`;
      this.dispatchEvent(new Event("drag"));
    };

    const onPointerUp = () => {
      this.#handleElt.releasePointerCapture(event.pointerId);
      document.documentElement.classList.remove("handle-dragging", directionClass);

      this.#handleElt.removeEventListener("pointermove", onPointerMove);
      this.#handleElt.removeEventListener("pointerup", onPointerUp);
      this.#handleElt.removeEventListener("pointercancel", onPointerUp);

      this.dispatchEvent(new Event("dragEnd"));
    };

    this.#handleElt.addEventListener("pointermove", onPointerMove);
    this.#handleElt.addEventListener("pointerup", onPointerUp);
    this.#handleElt.addEventListener("pointercancel", onPointerUp);
  };
}
