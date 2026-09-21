// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import type { Vector3Like } from "three";
import {
  FieldBinding,
  type JollyOption
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

  #mode = new FieldBinding<TransformMode>(this, {
    read: () => this.#transform.mode,
    write: (value) => {
      this.#transform.mode = value;
    }
  });

  #space = new FieldBinding<GizmoSpace>(this, {
    read: () => this.#transform.space,
    write: (value) => {
      this.#transform.space = value;
    }
  });

  #axisValues = new FieldBinding<Vector3Like>(this, {
    read: () => {
      const { x, y, z } = this.#transform.axisValues;

      return { x, y, z };
    },
    write: (value) => {
      this.#transform.axisValues = value;
    }
  });

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
        .value=${this.#mode.value}
        @jolly-change=${this.#mode.commit}
      ></jolly-button-group>

      <jolly-button-group
        aria-label="Transform space"
        .options=${kSpaceOptions}
        .value=${this.#space.value}
        ?disabled=${this.#transform.disabled || !kSpaceModes.includes(this.#transform.mode)}
        @jolly-change=${this.#space.commit}
      ></jolly-button-group>

      <jolly-vector3
        step="0.01"
        ?disabled=${this.#transform.disabled}
        .value=${this.#axisValues.value}
        @jolly-change=${this.#axisValues.commit}
      ></jolly-vector3>
    `;
  }
}

customElements.define("jolly-model-editor-transform", TransformPanel);
