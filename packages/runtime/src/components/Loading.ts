// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import { LitElement, css, html } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { property, state } from "lit/decorators.js";

// Import Internal Dependencies
import * as timers from "../utils/timers.ts";

// CONSTANTS
const kProgressAnimationDurationMs = 400;
const kFadeOutDurationMs = 500;
const kVelocityThreshold = 0.1;

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

  @state()
  declare imageError: boolean;

  static styles = css`
    :host {
      display: block;
      transition: opacity 0.5s ease-out;
    }

    :host([completed]) {
      opacity: 0;
    }

    #loading {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      color: #444;
      font-size: 24px;
      font-family: sans-serif;
      display: flex;
      flex-flow: column;
      align-items: center;
      justify-content: center;
      background: #eee;
    }

    :host(:not([started])) #loading {
      opacity: 0;
    }

    #loading a {
      transition: opacity 0.3s ease-out;
      position: relative;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
    }

    #loading a > * {
      pointer-events: none;
    }

    #loading img {
      width: 480px;
      height: 280px;
      max-width: 100%;
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
      animation: logo-fade-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      animation-delay: 0.2s;
    }

    #loading img.hidden {
      display: none;
    }

    @keyframes logo-fade-in {
      0% {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    :host([completed]) #loading img {
      animation: logo-fade-out 0.4s ease-out forwards;
    }

    @keyframes logo-fade-out {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translateY(-10px) scale(0.98);
      }
    }

    #loading .asset {
      margin-top: 20px;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #282e38ff;
      opacity: 0;
      animation: fade-slide-in 0.6s ease-out forwards;
      animation-delay: 0.5s;
      padding: 0 2em;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      /* Transition douce lors du changement d'asset */
      transition: opacity 0.2s ease-out;
    }

    /* Effet subtil de "pulse" pendant le chargement */
    @keyframes fade-slide-in {
      0% {
        opacity: 0;
        transform: translateY(10px);
      }
      100% {
        opacity: 0.8;
        transform: translateY(0);
      }
    }

    #loading .progress-container {
      width: 100%;
      height: 6px;
      background: linear-gradient(
        180deg,
        #b8bfb0 0%,
        #d0d4c3 50%,
        #b8bfb0 100%
      );
      overflow: hidden;
      position: relative;
      border-radius: 3px;
      box-shadow:
        inset 0 1px 2px rgba(0, 0, 0, 0.1),
        0 1px 0 rgba(255, 255, 255, 0.5);
      opacity: 0;
      animation: fade-slide-in 0.6s ease-out forwards;
      animation-delay: 0.7s;
      transform: translateZ(0);
      backface-visibility: hidden;
    }

    #loading .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        #2a5d8f 0%,
        #3E7CB8 50%,
        #4a8fd8 100%
      );
      transform: scaleX(var(--progress, 0));
      transform-origin: left center;
      transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      will-change: transform;
      box-shadow:
        0 0 10px rgba(62, 124, 184, 0.5),
        0 0 20px rgba(62, 124, 184, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
      animation: progress-pulse 1.5s ease-in-out infinite;
      backface-visibility: hidden;
    }

    #loading .progress-bar.speed-blur {
      animation: speed-blur 0.3s ease;
    }

    #loading .progress-bar::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.15) 30%,
        rgba(255, 255, 255, 0.4) 50%,
        rgba(255, 255, 255, 0.15) 70%,
        transparent 100%
      );
      animation: shimmer 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    #loading .progress-bar::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.2) 0%,
        transparent 50%,
        rgba(0, 0, 0, 0.1) 100%
      );
    }

    :host([completed]) .progress-bar {
      animation: none;
      box-shadow:
        0 0 10px rgba(62, 124, 184, 0.5),
        0 0 20px rgba(62, 124, 184, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }

    :host([completed]) .progress-bar::before {
      animation: none;
    }

    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    @keyframes progress-pulse {
      0%, 100% {
        box-shadow:
          0 0 10px rgba(62, 124, 184, 0.5),
          0 0 20px rgba(62, 124, 184, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      50% {
        box-shadow:
          0 0 15px rgba(62, 124, 184, 0.7),
          0 0 30px rgba(62, 124, 184, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }
    }

    #loading div.error {
      text-align: center;
      padding: 0 2em;
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 0.5px;
      font-family: Monaco, "DejaVu Sans Mono", "Lucida Console", "Andale Mono", monospace;
      color: #BF360C;
      text-transform: uppercase;
    }

    #loading pre.error {
      text-align: left;
      overflow: auto;
      padding: 1em;
      margin-top: 1em;
      background: #CFD8DC;
      color: #182024ff;
      font-size: 15px;
      border-radius: 4px;
    }

    /* Media queries pour mobile */
    @media (max-width: 600px) {
      #loading {
        padding: 15px;
      }

      #loading .asset {
        font-size: 11px;
        letter-spacing: 1px;
        margin-top: 15px;
      }

      #loading div.error {
        font-size: 16px;
        padding: 0 1em;
      }

      #loading pre.error {
        font-size: 13px;
        padding: 0.8em;
      }
    }

    @media (max-width: 400px) {
      #loading {
        padding: 10px;
      }

      #loading .asset {
        font-size: 10px;
        letter-spacing: 0.5px;
        margin-top: 12px;
      }

      #loading .progress-container {
        height: 5px;
      }
    }
  `;

  constructor() {
    super();
    this.started = false;
    this.completed = false;
    this.progress = 0;
    this.maxProgress = 100;
    this.errorMessage = "";
    this.errorStack = "";
    this.assetName = "Loading runtime...";
    this.imageError = false;
  }

  updated(
    changedProperties: Map<string, unknown>
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
    changedProperties: Map<string, unknown>
  ): void {
    const now = performance.now();
    const deltaTime = now - this.#lastProgressUpdate;
    const previousProgress = (changedProperties.get("progress") as number) || 0;

    this.#progressVelocity = (this.progress - previousProgress) / deltaTime;
    this.#lastProgressUpdate = now;
  }

  async start() {
    await this.updateComplete;

    requestAnimationFrame(() => {
      this.started = true;
    });
  }

  async complete(callback?: () => void): Promise<void> {
    this.progress = this.maxProgress;
    await this.updateComplete;

    // progression animation end (400ms)
    await timers.setTimeout(kProgressAnimationDurationMs);

    this.completed = true;

    // fade-out (500ms)
    await timers.setTimeout(kFadeOutDurationMs);

    this.remove();
    callback?.();
  }

  error(
    error: Error
  ) {
    this.errorMessage = error.message || "An error occurred";

    const causeStackTrace = (error?.cause as Error)?.stack ?? "";
    this.errorStack = causeStackTrace === "" ? (error.stack || "") : causeStackTrace;
    this.started = true;
    this.completed = false;
  }

  setAsset(
    asset: Systems.Asset
  ) {
    this.assetName = asset.toString();
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

  #handleImageError(): void {
    this.imageError = true;
  }

  render() {
    const progressBarClasses = classMap({
      "progress-bar": true,
      "speed-blur": this.#progressVelocity > kVelocityThreshold
    });

    const imageClasses = classMap({
      hidden: this.imageError
    });

    return html`
      <div id="loading">
        ${this.errorMessage ? html`
          <div class="error">${this.errorMessage}</div>
          <pre class="error">${this.errorStack}</pre>
        ` : html`
          <a href="https://github.com/JollyPixel" target="_blank">
            <img
              class="${imageClasses}"
              src="./images/jollypixel-full-logo-min.svg"
              @error="${this.#handleImageError}"
            >
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
