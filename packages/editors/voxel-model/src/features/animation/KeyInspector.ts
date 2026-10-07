// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  Mixed,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import type { AnimationInterpolation } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  KeyInspectorController,
  type KeyInspectorWorkspace
} from "./KeyInspectorController.ts";
import { INTERPOLATION_OPTIONS } from "./interpolation.ts";

export class KeyInspector extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-2, 8px);
      border-top: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
    }

    h3 {
      margin: 0;
      font-size: inherit;
      font-weight: 600;
    }
  `;

  #controller = new KeyInspectorController(this);

  attach(
    workspace: KeyInspectorWorkspace
  ): void {
    this.#controller.attach(workspace);
  }

  readonly #onInterpolation = (
    event: CustomEvent<JollyChangeDetail<AnimationInterpolation>>
  ): void => {
    this.#controller.setInterpolation(event.detail.value);
  };

  override render(): TemplateResult | typeof nothing {
    const { state } = this.#controller;
    if (state === null) {
      return nothing;
    }

    return html`
      <section aria-label="Key">
        <h3>Key (${state.title})</h3>
        <jolly-select
          label="Interpolation"
          .options=${INTERPOLATION_OPTIONS}
          .value=${state.interpolation === "mixed" ? Mixed : state.interpolation}
          @jolly-change=${this.#onInterpolation}
        ></jolly-select>
      </section>
    `;
  }
}

customElements.define("jolly-model-editor-key-inspector", KeyInspector);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-key-inspector": KeyInspector;
  }
}
