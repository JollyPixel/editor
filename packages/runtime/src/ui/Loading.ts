// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import {
  LitElement,
  html,
  type PropertyValues
} from "lit";
import { classMap } from "lit/directives/class-map.js";
import { property, state } from "lit/decorators.js";

// Import Internal Dependencies
import { JOLLY_PIXEL_LOGO } from "./JollyPixelLogo.ts";
import { loadingStyles } from "./Loading.styles.ts";

// CONSTANTS
const kProgressAnimationDurationMs = 400;
const kFadeOutDurationMs = 500;
const kVelocityThreshold = 0.1;

function isError(
  value: unknown
): value is Error {
  return value instanceof Error;
}

/**
 * Presents startup asset progress and fatal runtime initialization errors.
 */
export class Loading extends LitElement {
  #lastProgressUpdate = 0;
  #progressVelocity = 0;

  @property({ type: Boolean, reflect: true })
  declare started: boolean;

  @property({ type: Boolean, reflect: true })
  declare completed: boolean;

  @state()
  declare progress: number;

  @state()
  declare maxProgress: number;

  @state()
  declare assetName: string;

  @state()
  declare errorMessage: string;

  @state()
  declare errorStack: string;

  static styles = loadingStyles;

  constructor() {
    super();
    this.started = false;
    this.completed = false;
    this.progress = 0;
    this.maxProgress = 100;
    this.errorMessage = "";
    this.errorStack = "";
    this.assetName = "Loading runtime...";
  }

  updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (
      changedProperties.has("progress") ||
      changedProperties.has("maxProgress")
    ) {
      const percentage = this.getProgressPercentage() / 100;
      this.style.setProperty(
        "--progress",
        String(percentage)
      );

      this.#updateProgressVelocity(changedProperties);
    }
  }

  #updateProgressVelocity(
    changedProperties: PropertyValues<this>
  ): void {
    const now = performance.now();
    const deltaTime = now - this.#lastProgressUpdate;
    const previousProgress = changedProperties.get("progress") ?? 0;

    this.#progressVelocity = (this.progress - previousProgress) / deltaTime;
    this.#lastProgressUpdate = now;
  }

  async start() {
    await this.updateComplete;

    requestAnimationFrame(() => {
      this.started = true;
    });
  }

  async complete(
    callback?: () => void
  ): Promise<void> {
    if (this.maxProgress === 0) {
      this.maxProgress = 1;
    }
    this.progress = this.maxProgress;
    await this.updateComplete;

    // progression animation end (400ms)
    await waitForAnimation(kProgressAnimationDurationMs);

    this.completed = true;

    // fade-out (500ms)
    await waitForAnimation(kFadeOutDurationMs);

    this.remove();
    callback?.();
  }

  error(
    error: Error
  ) {
    this.errorMessage = error.message || "An error occurred";

    const causeStackTrace = isError(error.cause) ? (error.cause.stack ?? "") : "";
    this.errorStack = causeStackTrace === "" ? (error.stack || "") : causeStackTrace;
    this.started = true;
    this.completed = false;
  }

  setAsset(
    asset: AssetRecord
  ) {
    this.assetName = asset.source;
  }

  setProgress(
    value: number,
    max: number
  ) {
    this.progress = Math.max(0, Math.min(value, max));
    this.maxProgress = max;
  }

  getProgressPercentage(): number {
    if (this.maxProgress === 0) {
      return 0;
    }

    return (this.progress / this.maxProgress) * 100;
  }

  render() {
    const progressBarClasses = classMap({
      "progress-bar": true,
      "speed-blur": this.#progressVelocity > kVelocityThreshold
    });

    return html`
      <div id="loading">
        ${this.errorMessage ? html`
          <div class="error">${this.errorMessage}</div>
          <pre class="error">${this.errorStack}</pre>
        ` : html`
          <a href="https://github.com/JollyPixel" target="_blank">
            ${JOLLY_PIXEL_LOGO}
            <p class="asset">${this.assetName}</p>
            <div class="progress-container">
              <div class="${progressBarClasses}"></div>
            </div>
          </a>
        `}
      </div>
    `;
  }
}

customElements.define("jolly-loading", Loading);

function waitForAnimation(
  duration: number
): Promise<void> {
  const {
    promise,
    resolve
  } = Promise.withResolvers<void>();
  window.setTimeout(resolve, duration);

  return promise;
}
