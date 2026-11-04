// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ModelPreview } from "../preview/ModelPreview.ts";

export class ModelStatus extends LitElement {
  #preview = new SubscriptionController<ModelPreview>(this, (preview) => [
    preview.subscribe("change", () => this.requestUpdate())
  ]);

  static override styles = css`
    p {
      inline-size: fit-content;
      max-inline-size: 100%;
      margin: 0 auto;
      padding: var(--jolly-space-1) var(--jolly-space-3);
      border-radius: var(--jolly-radius-sm);
      color: var(--jolly-text);
      background: var(--jolly-surface-raised);
      overflow-wrap: anywhere;
    }

    p[data-failed] {
      color: var(--jolly-danger);
    }
  `;

  attach(
    preview: ModelPreview
  ): void {
    this.#preview.attach(preview);
  }

  override render(): TemplateResult | typeof nothing {
    const view = this.#preview.current?.view;
    switch (view?.status) {
      case "loading":
        return html`<p role="status">Loading the model…</p>`;
      case "empty":
        return html`<p role="status">This model file is empty.</p>`;
      case "failed":
        return html`
          <p role="alert" data-failed>
            Cannot read this model. ${view.error}
          </p>
        `;
      default:
        return nothing;
    }
  }
}

customElements.define("jolly-model-status", ModelStatus);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-status": ModelStatus;
  }
}
