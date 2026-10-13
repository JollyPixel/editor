// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import "@jolly-pixel/ui/feedback";

// CONSTANTS
const kLabel = "Loading editor";

export class LoadingBar extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      z-index: 100;
      inset: 0 0 auto;
      display: block;
      pointer-events: none;
      animation: loading-bar-reveal 0s 200ms both;
    }

    :host([blocking]) {
      inset: 0;
      pointer-events: auto;
      cursor: progress;
    }

    :host([hidden]) {
      display: none;
    }

    jolly-progress {
      --jolly-progress-height: 2px;
      --jolly-progress-track: transparent;
    }

    @keyframes loading-bar-reveal {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  get blocking(): boolean {
    return this.hasAttribute("blocking");
  }

  set blocking(
    value: boolean
  ) {
    this.toggleAttribute("blocking", value);
  }

  override render(): TemplateResult {
    return html`<jolly-progress label=${kLabel}></jolly-progress>`;
  }
}

customElements.define("jolly-editor-loading-bar", LoadingBar);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-editor-loading-bar": LoadingBar;
  }
}
