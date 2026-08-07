// Import Internal Dependencies
import { clamp } from "../../utils/math.ts";

// Constants
const kMargin = 4;

export interface ColorSwatchPortalOptions {
  anchor: HTMLElement;
  onDismiss: () => void;
}

/**
 * Floating panel anchored to an element.
 * Lives in document.body so global picker styles apply.
 */
export class ColorSwatchPortal {
  readonly element: HTMLDivElement;

  #anchor: HTMLElement;
  #onDismiss: () => void;
  #isOpen = false;
  #outsideClickHandler: (event: MouseEvent) => void;
  #keydownHandler: (event: KeyboardEvent) => void;

  constructor(
    options: ColorSwatchPortalOptions
  ) {
    this.#anchor = options.anchor;
    this.#onDismiss = options.onDismiss;

    const element = document.createElement("div");
    element.style.cssText = "position:fixed;z-index:9999;display:none;";
    document.body.appendChild(element);
    this.element = element;

    this.#outsideClickHandler = (event) => {
      if (!this.#isOpen) {
        return;
      }
      const path = event.composedPath();
      if (
        !path.includes(this.element) &&
        !path.includes(this.#anchor)
      ) {
        this.#onDismiss();
      }
    };
    document.addEventListener(
      "click",
      this.#outsideClickHandler
    );

    this.#keydownHandler = (event) => {
      if (this.#isOpen && event.key === "Escape") {
        this.#onDismiss();
      }
    };
    document.addEventListener(
      "keydown",
      this.#keydownHandler
    );
  }

  open(): void {
    this.#isOpen = true;
    this.element.style.display = "";
    this.#reposition();
  }

  close(): void {
    this.#isOpen = false;
    this.element.style.display = "none";
  }

  destroy(): void {
    document.removeEventListener(
      "click",
      this.#outsideClickHandler
    );
    document.removeEventListener(
      "keydown",
      this.#keydownHandler
    );
    this.element.remove();
  }

  /**
    * Flip above if needed and clamp to the viewport.
    * getBoundingClientRect() reads the size after unhide.
   */
  #reposition(): void {
    const anchorRect = this.#anchor.getBoundingClientRect();
    const portalRect = this.element.getBoundingClientRect();

    const fitsBelow = window.innerHeight - anchorRect.bottom >= portalRect.height + kMargin;
    const top = fitsBelow
      ? anchorRect.bottom + kMargin
      : Math.max(kMargin, anchorRect.top - portalRect.height - kMargin);

    const maxLeft = window.innerWidth - portalRect.width - kMargin;
    const left = clamp(
      anchorRect.left,
      kMargin,
      Math.max(kMargin, maxLeft)
    );

    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }
}
