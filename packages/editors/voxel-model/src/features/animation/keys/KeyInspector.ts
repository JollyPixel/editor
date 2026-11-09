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
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/select";
import type { AnimationInterpolation } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  KeyInspectorController,
  type KeyInspectorEditing
} from "./KeyInspectorController.ts";
import { INTERPOLATION_OPTIONS } from "./interpolation.ts";

export class KeyInspector extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    jolly-select {
      margin-inline-start: var(--jolly-space-1, 4px);
    }
  `;

  #controller = new KeyInspectorController(this);

  attach(
    editing: KeyInspectorEditing
  ): void {
    this.#controller.attach(editing);
  }

  readonly #onInterpolation = (
    event: CustomEvent<JollyChangeDetail<AnimationInterpolation>>
  ): void => {
    this.#controller.applyInterpolation(event.detail.value);
  };

  override render(): TemplateResult | typeof nothing {
    const { state } = this.#controller;
    if (state === null) {
      return nothing;
    }

    return html`
      <jolly-folder
        flush
        role="region"
        aria-label="Key"
        key="key"
        label="Key (${state.title})"
        storage-key="voxel-model:folder:key"
      >
        <jolly-select
          label="Interpolation"
          .options=${INTERPOLATION_OPTIONS}
          ?readonly=${!state.editable}
          .value=${state.interpolation === "mixed" ? Mixed : state.interpolation}
          @jolly-change=${this.#onInterpolation}
        ></jolly-select>
      </jolly-folder>
    `;
  }
}

customElements.define("jolly-model-editor-key-inspector", KeyInspector);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-key-inspector": KeyInspector;
  }
}
