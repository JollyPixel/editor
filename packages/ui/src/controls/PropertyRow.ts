// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { propertyRowStyles } from "./PropertyRow.styles.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";
import { revealOverflowTitle } from "../interaction/overflowTitle.ts";
import { descriptionHintStyles } from "../field/DescriptionHint.styles.ts";
import {
  DescriptionHint,
  type FieldDescriptionDisplay
} from "../field/DescriptionHint.ts";
import {
  DEFAULT_STACK_BELOW,
  LabelStackController,
  type FieldLabelPosition
} from "../field/LabelStackController.ts";
import type { FieldAlign } from "../field/JollyField.ts";

// Registers the icon used by descriptions.
import "../icon/Icon.ts";

/**
 * Field-aligned layout for custom content.
 */
@customElement("jolly-property-row")
export class PropertyRow extends LitElement {
  static override styles = [
    propertyRowStyles,
    descriptionHintStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare description: string;

  @property({ type: String, reflect: true })
  declare align: FieldAlign;

  @property({
    type: String,
    attribute: "label-position",
    reflect: true
  })
  declare labelPosition: FieldLabelPosition;

  @property({
    type: Number,
    attribute: "stack-below"
  })
  declare stackBelow: number;

  @property({
    type: String,
    attribute: "description-display",
    reflect: true
  })
  declare descriptionDisplay: FieldDescriptionDisplay;

  #hint = new DescriptionHint(this);

  constructor() {
    super();

    this.label = "";
    this.description = "";
    this.align = "start";
    this.labelPosition = "inline";
    this.stackBelow = DEFAULT_STACK_BELOW;
    this.descriptionDisplay = "block";
    new LabelStackController(this);
  }

  override render(): TemplateResult {
    return html`
      <div class="row">
        <div class="leading">
          <div class="label-cell">${this.#renderHint()}${this.#renderLabel()}</div>
        </div>
        <div class="value"><slot></slot></div>
      </div>
      ${this.description === "" || this.#hintsDescription
        ? nothing
        : html`
          <p class="description">
            <jolly-icon name="info"></jolly-icon>
            <span>${this.description}</span>
          </p>
        `}
    `;
  }

  get #hintsDescription(): boolean {
    return this.descriptionDisplay === "tooltip" && this.description !== "";
  }

  #renderLabel(): TemplateResult | typeof nothing {
    return this.label === "" ? nothing : html`<span
      class="label"
      @pointerenter=${revealOverflowTitle}
    >${this.label}</span>`;
  }

  #renderHint(): TemplateResult | typeof nothing {
    return this.#hintsDescription ?
      this.#hint.render(this.label, this.description) :
      nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-property-row": PropertyRow;
  }
}
