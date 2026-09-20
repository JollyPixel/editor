// Import Third-party Dependencies
import {
  LitElement,
  css,
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
import {
  getIcon,
  iconTone,
  isIconTone,
  type IconName,
  type IconTone
} from "./registry.ts";

// Registers built-in glyphs with the element.
import "./builtins.ts";

// CONSTANTS
const kWarned = new Set<string>();

@customElement("jolly-icon")
export class Icon extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      width: var(--jolly-icon-size, 16px);
      height: var(--jolly-icon-size, 16px);
      color: inherit;
    }

    svg {
      --jolly-icon-tone-mix: var(
        --jolly-icon-tone-strength,
        var(--jolly-icon-tone-rest, 100%)
      );

      display: block;
      width: 100%;
      height: 100%;
    }

    @media (forced-colors: active) {
      svg {
        --jolly-icon-tone-mix: 0%;
      }
    }

    .tone-fill {
      fill: color-mix(
        in oklab,
        var(--jolly-icon-tone-color, currentcolor) var(--jolly-icon-tone-mix),
        transparent
      );
      transition: fill var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
    }

    .tone-ink {
      color: color-mix(
        in oklab,
        var(--jolly-icon-tone-color, currentcolor) var(--jolly-icon-tone-mix),
        currentcolor
      );
      transition: color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
    }
  `;

  @property({ type: String })
  declare name: IconName;

  @property({ type: String })
  declare label: string;

  @property({ type: String, reflect: true })
  declare tone: IconTone | "";

  @property({
    type: Boolean,
    attribute: "on-fill",
    reflect: true
  })
  declare onFill: boolean;

  constructor() {
    super();

    this.name = "";
    this.label = "";
    this.tone = "";
    this.onFill = false;
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
        style=${this.#toneStyle()}
      >${svg`${glyph}`}</svg>
    `;
  }

  #toneStyle(): string | typeof nothing {
    const tone = isIconTone(this.tone) ? this.tone : iconTone(this.name);
    if (tone === null) {
      return nothing;
    }

    const suffix = this.onFill ? "-on-fill" : "";

    return `--jolly-icon-tone-color: var(--jolly-tone-${tone}${suffix})`;
  }

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
