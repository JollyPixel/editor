// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { classMap } from "lit/directives/class-map.js";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { progressStyles } from "./Progress.styles.ts";
import {
  normalizeProgress,
  type NormalizedProgress
} from "./normalizeProgress.ts";

// CONSTANTS
const kVelocityThreshold = 0.1;

/**
 * Displays determinate or indeterminate progress for a long-running operation.
 * Omit value for the indeterminate state.
 */
@customElement("jolly-progress")
export class Progress extends LitElement {
  static override styles = progressStyles;

  @property({ type: Number })
  declare value: number | null;

  @property({ type: Number })
  declare max: number;

  @property({ type: String })
  declare label: string;

  @property({ type: String, attribute: "value-text" })
  declare valueText: string;

  @property({ type: Boolean, reflect: true })
  declare animated: boolean;

  @property({ type: Boolean, reflect: true })
  declare completed: boolean;

  #lastProgressUpdate = 0;
  #normalized: NormalizedProgress;
  #speeding = false;

  constructor() {
    super();
    this.value = null;
    this.max = 1;
    this.label = "";
    this.valueText = "";
    this.animated = false;
    this.completed = false;
    this.#normalized = normalizeProgress(
      this.value,
      this.max
    );
  }

  protected override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (
      changedProperties.has("value") ||
      changedProperties.has("max")
    ) {
      this.#updateVelocity(changedProperties);
      this.#normalized = normalizeProgress(
        this.value,
        this.max
      );
    }
  }

  override render(): TemplateResult {
    const ratio = this.#normalized.ratio;
    const trackClasses = classMap({
      track: true,
      indeterminate: ratio === null
    });
    const indicatorClasses = classMap({
      indicator: true,
      speeding: this.#speeding
    });

    return html`
      <div
        class=${trackClasses}
        part="track"
        role="progressbar"
        aria-label=${this.label === "" ? nothing : this.label}
        aria-valuemin="0"
        aria-valuemax=${this.#normalized.max}
        aria-valuenow=${this.#normalized.value ?? nothing}
        aria-valuetext=${this.valueText === "" ? nothing : this.valueText}
      >
        <div
          class=${indicatorClasses}
          part="indicator"
          style=${ratio === null
            ? nothing
            : `--jolly-progress-ratio:${ratio}`}
        ></div>
      </div>
    `;
  }

  #updateVelocity(
    changedProperties: PropertyValues<this>
  ): void {
    const previousValue = changedProperties.get("value");
    const now = performance.now();
    const elapsed = now - this.#lastProgressUpdate;
    this.#lastProgressUpdate = now;
    if (
      previousValue === undefined ||
      previousValue === null ||
      this.value === null ||
      elapsed <= 0
    ) {
      this.#speeding = false;

      return;
    }

    this.#speeding = (
      (this.value - previousValue) / elapsed
    ) > kVelocityThreshold;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-progress": Progress;
  }
}
