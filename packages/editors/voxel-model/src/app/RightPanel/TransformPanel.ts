// Import Third-party Dependencies
import { LitElement, css, html, type TemplateResult } from "lit";
import { type JollyChangeDetail, type JollyOption } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { GizmoSpace, ModelSceneComponent } from "../ModelSceneComponent.ts";
import {
  TransformPanelController,
  type TransformMode,
  type Vector3Value
} from "../../features/transform/TransformPanelController.ts";

// CONSTANTS
const kTransformModes: JollyOption<TransformMode>[] = [
  { value: "pos", label: "Pos" },
  { value: "angle", label: "Angle" },
  { value: "size", label: "Size" },
  { value: "pivot", label: "Pivot" },
  { value: "scale", label: "Scale" }
];

const kSpaceOptions: JollyOption<GizmoSpace>[] = [
  { value: "local", label: "Local" },
  { value: "world", label: "Global" }
];

const kSpaceModes: readonly TransformMode[] = ["pos", "angle", "pivot"];

export class TransformPanel extends LitElement {
  #transform = new TransformPanelController(this);

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2, 8px);
      box-sizing: border-box;
      padding: var(--jolly-space-2, 8px);
    }

    jolly-vector3 {
      max-width: 100%;
    }
  `;

  public attach(
    sceneManager: ModelSceneComponent
  ): void {
    this.#transform.attach(sceneManager);
  }

  override render(): TemplateResult {
    return html`
      <jolly-button-group
        .options=${kTransformModes}
        .value=${this.#transform.mode}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<TransformMode>>) => {
          this.#transform.setMode(event.detail.value);
        }}
      ></jolly-button-group>

      <jolly-button-group
        .options=${kSpaceOptions}
        .value=${this.#transform.space}
        ?disabled=${this.#transform.disabled || !kSpaceModes.includes(this.#transform.mode)}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<GizmoSpace>>) => {
          this.#transform.setSpace(event.detail.value);
        }}
      ></jolly-button-group>

      <jolly-vector3
        step="0.01"
        ?disabled=${this.#transform.disabled}
        .value=${this.#transform.axisValues}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<Vector3Value>>) => {
          this.#transform.setAxisValues(event.detail.value);
        }}
      ></jolly-vector3>
    `;
  }
}

customElements.define("jolly-model-editor-transform", TransformPanel);
