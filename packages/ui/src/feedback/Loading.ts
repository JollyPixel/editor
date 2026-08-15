// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import { JOLLY_PIXEL_LOGO } from "./JollyPixelLogo.ts";
import { loadingStyles } from "./Loading.styles.ts";
import "./Progress.ts";

// CONSTANTS
const kProgressAnimationDurationMs = 400;
const kFadeOutDurationMs = 500;

function isError(
  value: unknown
): value is Error {
  return value instanceof Error;
}

/**
 * Presents branded startup progress and fatal initialization errors.
 */
@customElement("jolly-loading")
export class Loading extends LitElement {
  static override styles = loadingStyles;

  @property({
    type: Boolean,
    reflect: true
  })
  declare started: boolean;

  @property({
    type: Boolean,
    reflect: true
  })
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

  constructor() {
    super();
    this.started = false;
    this.completed = false;
    this.progress = 0;
    this.maxProgress = 100;
    this.assetName = "Loading runtime...";
    this.errorMessage = "";
    this.errorStack = "";
  }

  async start(): Promise<void> {
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
    await waitForAnimation(kProgressAnimationDurationMs);

    this.completed = true;
    await waitForAnimation(kFadeOutDurationMs);

    this.remove();
    callback?.();
  }

  error(
    error: Error
  ): void {
    this.errorMessage = error.message || "An error occurred";

    const causeStack = isError(error.cause)
      ? (error.cause.stack ?? "")
      : "";
    this.errorStack = causeStack === ""
      ? (error.stack ?? "")
      : causeStack;
    this.started = true;
    this.completed = false;
  }

  /**
   * Fades out and detaches the element. Callers use this to close the error
   * view once the user has acknowledged it (`complete()` covers the success
   * path and already detaches on its own).
   */
  async dismiss(): Promise<void> {
    this.completed = true;
    await waitForAnimation(kFadeOutDurationMs);
    this.remove();
  }

  setAsset(
    assetName: string
  ): void {
    this.assetName = assetName;
  }

  setProgress(
    value: number,
    max: number
  ): void {
    this.progress = Math.max(0, Math.min(value, max));
    this.maxProgress = max;
  }

  getProgressPercentage(): number {
    if (this.maxProgress === 0) {
      return 0;
    }

    return (this.progress / this.maxProgress) * 100;
  }

  override render(): TemplateResult {
    return html`
      <div id="loading">
        ${this.errorMessage === ""
          ? this.#renderProgress()
          : this.#renderError()}
      </div>
    `;
  }

  #renderProgress(): TemplateResult {
    return html`
      <a
        href="https://github.com/JollyPixel"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${JOLLY_PIXEL_LOGO}
        <p class="asset" aria-live="polite">${this.assetName}</p>
        <jolly-progress
          class="progress-container"
          .value=${this.progress}
          .max=${this.maxProgress}
          .label=${this.assetName}
          .animated=${true}
          .completed=${this.completed}
        ></jolly-progress>
      </a>
    `;
  }

  #renderError(): TemplateResult {
    return html`
      <div class="error" role="alert">${this.errorMessage}</div>
      <pre class="error">${this.errorStack}</pre>
      <button
        class="dismiss"
        type="button"
        @click=${() => this.dismiss()}
      >Dismiss</button>
    `;
  }
}

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

declare global {
  interface HTMLElementTagNameMap {
    "jolly-loading": Loading;
  }
}
