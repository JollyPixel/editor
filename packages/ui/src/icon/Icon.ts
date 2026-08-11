// Import Third-party Dependencies
import {
  LitElement,
  html,
  svg,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { iconStyles } from "./Icon.styles.ts";
import {
  getIcon,
  type IconName
} from "./registry.ts";

// Registers built-in glyphs with the element.
import "./builtins.ts";

// CONSTANTS
const kWarned = new Set<string>();

/**
 * Renders a registered glyph;
 * unlabeled icons are decorative.
 */
@customElement("jolly-icon")
export class Icon extends LitElement {
  static override styles = [
    iconStyles
  ];

  @property({ type: String })
  declare name: IconName;

  @property({ type: String })
  declare label: string;

  constructor() {
    super();

    this.name = "";
    this.label = "";
  }

  override render(): TemplateResult | typeof nothing {
    const glyph = getIcon(this.name);
    if (glyph === null) {
      this.#warnUnknown();

      return nothing;
    }

    const decorative = this.label === "";

    return html`
      <svg
        viewBox="0 0 24 24"
        fill="none"
        role=${decorative ? "presentation" : "img"}
        aria-hidden=${decorative ? "true" : nothing}
        aria-label=${decorative ? nothing : this.label}
      >${svg`${glyph}`}</svg>
    `;
  }

  /**
   * Warns about unregistered runtime icon names.
   */
  #warnUnknown(): void {
    if (
      this.name === "" ||
      kWarned.has(this.name)
    ) {
      return;
    }

    kWarned.add(this.name);
    console.warn(
      `[jolly-pixel/ui] unknown icon "${this.name}". Register it with registerIcon() before use.`
    );
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "jolly-icon": Icon;
  }
}
