// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";

export class Loading extends LitElement {
  @property({ type: Boolean, reflect: true })
  declare started: boolean;

  @property({ type: Boolean, reflect: true })
  declare completed: boolean;

  @state()
  declare progress: number;

  @state()
  declare maxProgress: number;

  @state()
  declare errorMessage: string;

  static styles = css`
    #loading {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      color: #444;
      font-size: 24px;
      font-family: sans-serif;
      text-transform: uppercase;
      display: flex;
      flex-flow: column;
      align-items: center;
      justify-content: center;
      background: #eee;
      transition: opacity 0.5s ease-out;
    }

    :host([completed]) #loading {
      opacity: 0;
      pointer-events: none;
    }

    :host(:not([started])) #loading {
      opacity: 0;
    }

    :host([started]) #loading a {
      opacity: 1;
    }

    :host(:not([started])) #loading a {
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
    }

    #loading progress {
      background: #c4c8b7;
      margin-top: 10px;
      width: 100%;
      height: 5px;
    }

    #loading progress::-webkit-progress-bar {
      background: #d0d4c3;
    }
    #loading progress::-webkit-progress-value {
      background: #a5a49e;
    }
    #loading progress::-moz-progress-bar {
      background: #a5a49e;
    }

    #loading .error {
      text-align: center;
      padding: 0 2em;
      font-size: 18px;
      color: red;
    }
  `;

  constructor() {
    super();
    this.started = false;
    this.completed = false;
    this.progress = 0;
    this.maxProgress = 100;
    this.errorMessage = "";
  }

  start() {
    this.updateComplete.then(() => {
      requestAnimationFrame(() => {
        this.started = true;
        this.completed = false;
        this.errorMessage = "";
      });
    });
  }

  complete(callback?: () => void) {
    this.completed = true;

    setTimeout(() => {
      this.remove();
      callback?.();
    }, 500);
  }

  error(error: Error) {
    this.errorMessage = error.message || "An error occurred";
    this.started = true;
    this.completed = false;
  }

  setProgress(
    value: number,
    max: number
  ) {
    this.progress = Math.max(0, Math.min(value, max));
    this.maxProgress = max;
  }

  getProgressPercentage(): number {
    return (this.progress / this.maxProgress) * 100;
  }

  render() {
    return html`
      <div id="loading">
        ${this.errorMessage ? html`
          <div class="error">${this.errorMessage}</div>
        ` : html`
          <a href="https://github.com/JollyPixel" target="_blank">
            <img src="./images/jollypixel-full-logo-min.svg" draggable="false">
            <progress
              max="${this.maxProgress}"
              value="${this.progress}">
            </progress>
          </a>
        `}
      </div>
    `;
  }
}

customElements.define("jolly-loading", Loading);
