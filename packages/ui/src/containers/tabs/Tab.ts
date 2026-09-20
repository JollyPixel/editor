// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { IconName } from "../../icon/registry.ts";

// CONSTANTS
const kStripProperties = [
  "label",
  "disabled",
  "closable",
  "tooltip",
  "badge",
  "action",
  "actionLabel"
] as const;

@customElement("jolly-tab")
export class Tab extends LitElement {
  static override styles = css`
    :host {
      display: none;
      box-sizing: border-box;
      height: 100%;
    }

    :host([active]) {
      display: block;
    }
  `;

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare value: string;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({ type: Boolean, reflect: true })
  declare active: boolean;

  @property({ type: Boolean, reflect: true })
  declare closable: boolean;

  @property({ type: String })
  declare tooltip: string;

  @property({ type: String })
  declare badge: string;

  @property({ type: String })
  declare action: IconName;

  @property({ type: String, attribute: "action-label" })
  declare actionLabel: string;

  constructor() {
    super();

    this.label = "";
    this.value = "";
    this.disabled = false;
    this.active = false;
    this.closable = false;
    this.tooltip = "";
    this.badge = "";
    this.action = "";
    this.actionLabel = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "tabpanel");
  }

  protected override updated(
    changed: PropertyValues<this>
  ): void {
    const parent = this.parentElement;
    if (
      parent instanceof LitElement &&
      parent.tagName === "JOLLY-TABS" &&
      kStripProperties.some((key) => changed.has(key))
    ) {
      parent.requestUpdate();
    }
  }

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tab": Tab;
  }
}
