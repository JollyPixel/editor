// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import Picker from "vanilla-picker";

export interface ColorChangeDetail {
  hex: string;
  opacity: number;
}

/**
 * A color swatch button that opens a vanilla-picker popup and reports
 * changes via a "color-change" CustomEvent<ColorChangeDetail>.
 *
 * @fires {CustomEvent<ColorChangeDetail>} color-change - Fired when the user picks a new color/opacity.
 */
@customElement("color-swatch")
export class ColorSwatch extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
    }

    button {
      width: 26px;
      height: 26px;
      border: 2px solid var(--color-swatch-border, var(--color-border, #556067));
      border-radius: var(--color-swatch-radius, 4px);
      cursor: pointer;
      padding: 0;
      background: #000000;
      box-sizing: border-box;
    }

    button:focus-visible {
      outline: 2px solid var(--color-swatch-focus-color, var(--color-accent, #4488ff));
      outline-offset: 2px;
    }
  `;

  @property({ type: String }) declare color: string;
  @property({ type: Number }) declare opacity: number;

  // Plain private fields, not @state(): Lit's legacy decorators can't target
  // true #private fields (TS1206), so reactivity here is driven manually via
  // requestUpdate() instead of the decorator.
  #open = false;
  #buttonEl: HTMLButtonElement | null = null;
  #picker: Picker | null = null;
  #portal: HTMLDivElement | null = null;
  #outsideClickHandler: ((event: MouseEvent) => void) | null = null;
  #keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super();
    this.color = "#000000";
    this.opacity = 1;
  }

  override firstUpdated() {
    // Portal: vanilla-picker injects CSS into <head>, which doesn't pierce
    // Shadow DOM. Appending to document.body keeps it in the regular DOM
    // where those styles apply.
    const portal = document.createElement("div");
    portal.style.cssText = "position:fixed;z-index:9999;display:none;";
    document.body.appendChild(portal);
    this.#portal = portal;

    const swatchEl = this.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    this.#buttonEl = swatchEl;
    swatchEl.style.background = this.#toRgbaString();

    this.#picker = new Picker({
      parent: portal,
      popup: false,
      alpha: true,
      editor: true,
      editorFormat: "hex",
      color: this.#toRgbaHex(),
      onChange: (color) => {
        const hex = color.hex.slice(0, 7);
        const alpha = color.rgba[3];
        this.color = hex;
        this.opacity = alpha;
        swatchEl.style.background = color.rgbaString;
        this.dispatchEvent(new CustomEvent<ColorChangeDetail>("color-change", {
          bubbles: true,
          composed: true,
          detail: { hex, opacity: alpha }
        }));
      },
      onDone: () => {
        // With popup:false, vanilla-picker never manages its own visibility —
        // the "Ok" button/Enter key normally only close a picker in popup mode.
        this.#setOpen(false);
      }
    });

    swatchEl.addEventListener("click", this.#onSwatchClick);

    const outsideClickHandler = (event: MouseEvent) => {
      const path = event.composedPath();
      if (!path.includes(portal) && !path.includes(swatchEl)) {
        this.#setOpen(false);
      }
    };
    document.addEventListener("click", outsideClickHandler);
    this.#outsideClickHandler = outsideClickHandler;

    const keydownHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && this.#open) {
        this.#setOpen(false);
      }
    };
    document.addEventListener("keydown", keydownHandler);
    this.#keydownHandler = keydownHandler;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#buttonEl?.removeEventListener("click", this.#onSwatchClick);
    if (this.#outsideClickHandler) {
      document.removeEventListener("click", this.#outsideClickHandler);
      this.#outsideClickHandler = null;
    }
    if (this.#keydownHandler) {
      document.removeEventListener("keydown", this.#keydownHandler);
      this.#keydownHandler = null;
    }
    this.#picker?.destroy?.();
    this.#picker = null;
    this.#portal?.remove();
    this.#portal = null;
  }

  /**
   * Mirrors an externally-picked color (e.g. the canvas eyedropper) onto the
   * swatch/picker without re-emitting "color-change".
   */
  setColor(
    hex: string,
    opacity = 1
  ): void {
    this.color = hex;
    this.opacity = opacity;

    if (this.#picker) {
      const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
      this.#picker.setColor(`${hex}${alphaHex}`, true);
    }
    if (this.#buttonEl) {
      this.#buttonEl.style.background = this.#toRgbaString();
    }
  }

  /**
   * Closes the picker if open. Lets a container holding multiple swatches
   * (e.g. foreground/background) enforce only one open at a time.
   */
  close(): void {
    this.#setOpen(false);
  }

  #setOpen(
    open: boolean
  ): void {
    this.#open = open;
    const portal = this.#portal!;
    if (open) {
      portal.style.display = "";
      this.#positionPortal();
      // Lets a container close sibling swatches so only one picker is open at a time.
      this.dispatchEvent(new CustomEvent("swatch-opened", { bubbles: true, composed: true }));
    }
    else {
      portal.style.display = "none";
    }
    this.requestUpdate();
  }

  /**
   * Flips the popup above the button when there isn't enough room below (and
   * clamps both axes to the viewport) instead of letting it run off-screen.
   * getBoundingClientRect() forces the layout needed to measure the portal's
   * real size right after `display` is unhidden.
   */
  #positionPortal(): void {
    const portal = this.#portal!;
    const margin = 4;
    const buttonRect = this.#buttonEl!.getBoundingClientRect();
    const portalRect = portal.getBoundingClientRect();

    const fitsBelow = window.innerHeight - buttonRect.bottom >= portalRect.height + margin;
    const top = fitsBelow
      ? buttonRect.bottom + margin
      : Math.max(margin, buttonRect.top - portalRect.height - margin);

    const maxLeft = window.innerWidth - portalRect.width - margin;
    const left = Math.min(buttonRect.left, Math.max(margin, maxLeft));

    portal.style.top = `${top}px`;
    portal.style.left = `${left}px`;
  }

  readonly #onSwatchClick = (
    event: MouseEvent
  ): void => {
    // stopPropagation prevents the document click handler from immediately
    // closing the portal on the same event tick.
    event.stopPropagation();
    this.#setOpen(!this.#open);
  };

  #toRgbaHex(): string {
    const alphaHex = Math.round(this.opacity * 255).toString(16).padStart(2, "0");

    return `${this.color}${alphaHex}`;
  }

  #toRgbaString(): string {
    const r = parseInt(this.color.slice(1, 3), 16);
    const g = parseInt(this.color.slice(3, 5), 16);
    const b = parseInt(this.color.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${this.opacity})`;
  }

  override render() {
    return html`
      <button
        part="swatch"
        title="Color"
        aria-haspopup="dialog"
        aria-expanded=${this.#open}
      ></button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-swatch": ColorSwatch;
  }
}
