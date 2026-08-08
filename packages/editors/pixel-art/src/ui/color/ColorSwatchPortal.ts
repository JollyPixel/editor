// Import Internal Dependencies
import { clamp } from "../../utils/math.ts";
import { colorSwatchPortalStyles } from "./ColorSwatchPortal.styles.ts";

// Constants
const kMargin = 24;
const kStyleElementId = "color-swatch-portal-theme";
const kThemeProperties = [
  "--color-bg-overlay",
  "--color-bg-surface",
  "--color-border",
  "--color-divider",
  "--color-text",
  "--color-text-on-accent",
  "--color-accent"
];

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

    ColorSwatchPortal.#ensureStylesInjected();

    const element = document.createElement("div");
    element.className = "color-swatch-portal";
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
    this.#syncTheme();
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

  #reposition(): void {
    const anchorRect = this.#anchor.getBoundingClientRect();
    const portalRect = this.element.getBoundingClientRect();

    const fitsRight = window.innerWidth - anchorRect.right >= portalRect.width + kMargin;
    const left = fitsRight
      ? anchorRect.right + kMargin
      : Math.max(kMargin, anchorRect.left - portalRect.width - kMargin);

    const maxTop = window.innerHeight - portalRect.height - kMargin;
    const top = clamp(
      anchorRect.top,
      kMargin,
      Math.max(kMargin, maxTop)
    );

    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }

  #syncTheme(): void {
    const anchorStyle = getComputedStyle(this.#anchor);

    for (const property of kThemeProperties) {
      this.element.style.setProperty(
        property,
        anchorStyle.getPropertyValue(property)
      );
    }
  }

  static #ensureStylesInjected(): void {
    if (document.getElementById(kStyleElementId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = kStyleElementId;
    style.textContent = colorSwatchPortalStyles;
    document.head.appendChild(style);
  }
}
