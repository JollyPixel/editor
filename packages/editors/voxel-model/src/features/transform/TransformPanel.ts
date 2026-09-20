// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import type { Vector3Like } from "three";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import "./transformIcons.ts";
import type { GizmoSpace } from "../../scene/index.ts";
import {
  TransformPanelController,
  type TransformMode,
  type TransformWorkspace
} from "./TransformPanelController.ts";

// CONSTANTS
const kTransformModes: JollyOption<TransformMode>[] = [
  {
    value: "pos",
    label: "Pos",
    icon: "transform-position"
  },
  {
    value: "angle",
    label: "Angle",
    icon: "transform-angle"
  },
  {
    value: "size",
    label: "Size",
    icon: "transform-size"
  },
  {
    value: "pivot",
    label: "Pivot",
    icon: "transform-pivot"
  },
  {
    value: "scale",
    label: "Scale",
    icon: "transform-scale"
  }
];

const kSpaceOptions: JollyOption<GizmoSpace>[] = [
  {
    value: "local",
    label: "Local",
    icon: "transform-local"
  },
  {
    value: "world",
    label: "Global",
    icon: "transform-global"
  }
];

const kSpaceModes: readonly TransformMode[] = ["pos", "angle", "pivot"];

export class TransformPanel extends LitElement {
  #transform = new TransformPanelController(this);

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    jolly-vector3 {
      max-width: 100%;
    }
  `;

  attach(
    workspace: TransformWorkspace
  ): void {
    this.#transform.attach(workspace);
  }

  override render(): TemplateResult {
    return html`
      <jolly-button-group
        icon-only
        aria-label="Transform mode"
        .options=${kTransformModes}
        .value=${this.#transform.mode}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<TransformMode>>) => {
          this.#transform.mode = event.detail.value;
        }}
      ></jolly-button-group>

      <jolly-button-group
        aria-label="Transform space"
        .options=${kSpaceOptions}
        .value=${this.#transform.space}
        ?disabled=${this.#transform.disabled || !kSpaceModes.includes(this.#transform.mode)}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<GizmoSpace>>) => {
          this.#transform.space = event.detail.value;
        }}
      ></jolly-button-group>

      <jolly-vector3
        step="0.01"
        ?disabled=${this.#transform.disabled}
        .value=${this.#transform.axisValues}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<Vector3Like>>) => {
          this.#transform.axisValues = event.detail.value;
        }}
      ></jolly-vector3>
    `;
  }
}

customElements.define("jolly-model-editor-transform", TransformPanel);
