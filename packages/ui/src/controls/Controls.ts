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
import { controlsStyles } from "./Controls.styles.ts";

export type ControlsPosition =
  | "top-left"
  | "top-middle"
  | "top-right"
  | "middle-left"
  | "middle"
  | "middle-right"
  | "bottom-left"
  | "bottom-middle"
  | "bottom-right";

export interface ControlsDefaults {
  position: ControlsPosition;
  maxEntriesPerRow: number;
  heading: string;
}

/**
 * A positioned, declarative HUD card for scene control hints.
 */
@customElement("jolly-controls")
export class Controls extends LitElement {
  static readonly Defaults: ControlsDefaults = {
    position: "bottom-left",
    maxEntriesPerRow: 3,
    heading: ""
  };

  static override styles = controlsStyles;

  @property({ type: String, reflect: true })
  declare position: ControlsPosition;

  @property({
    type: Number,
    attribute: "max-entries-per-row"
  })
  declare maxEntriesPerRow: number;

  @property({ type: String })
  declare heading: string;

  constructor() {
    super();

    this.position = Controls.Defaults.position;
    this.maxEntriesPerRow = Controls.Defaults.maxEntriesPerRow;
    this.heading = Controls.Defaults.heading;
  }

  override render(): TemplateResult {
    const maximum = Math.max(
      1,
      Math.floor(this.maxEntriesPerRow)
    );
    const headingId = "heading";

    return html`
      ${this.heading === ""
        ? nothing
        : html`<h2 class="heading" id=${headingId}>${this.heading}</h2>`}
      <div
        class="entries"
        role="list"
        aria-label=${this.heading === "" ? "Controls" : nothing}
        aria-labelledby=${this.heading === "" ? nothing : headingId}
        style=${`--jolly-controls-max-entries-per-row:${maximum}`}
      >
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-controls": Controls;
  }
}
