// Import Third-party Dependencies
import {
  html,
  css,
  nothing
} from "lit";
import { customElement } from "lit/decorators.js";
import { VoxelRotation } from "@jolly-pixel/voxel.renderer";
import {
  FieldBinding,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/toggle";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../../editing/EditingElement.ts";
import type { RotationMode } from "../../../state/index.ts";

// CONSTANTS
const kRotationOptions: JollyOption<RotationMode>[] = [
  { label: "Auto", value: "auto" },
  { label: "0°", value: VoxelRotation.None },
  { label: "CCW 90°", value: VoxelRotation.CCW90 },
  { label: "180°", value: VoxelRotation.Deg180 },
  { label: "CW 90°", value: VoxelRotation.CW90 }
];

@customElement("brush-orientation")
export class BrushOrientation extends EditingElement {
  static override styles = css`
    :host {
      --brush-orientation-height: max(
        16px,
        calc(var(--jolly-control-height, 20px) - 4px)
      );

      display: flex;
      align-items: center;
      gap: 1px;
      border-radius: var(--jolly-radius-sm, 2px);
      overflow: hidden;
    }

    jolly-button-group,
    jolly-toggle {
      --jolly-row-height: var(--brush-orientation-height);
      --jolly-control-height: var(--brush-orientation-height);
      --jolly-field-inset-start: 0px;
      --jolly-field-inset-end: 0px;
      --jolly-radius-sm: 0;
    }

    jolly-button-group {
      flex: 1 1 auto;
      min-width: 0;
    }

    jolly-toggle {
      flex: 0 0 auto;
    }
  `;

  #rotation = new FieldBinding<RotationMode>(this, {
    read: () => this.attached.state.brush.rotationMode,
    write: (value) => {
      this.attached.state.brush.rotationMode = value;
    }
  });

  #flipY = new FieldBinding<boolean>(this, {
    read: () => this.attached.state.brush.flipY,
    write: (value) => {
      this.attached.state.brush.flipY = value;
    }
  });

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    return [
      editing.state.brush.subscribe("change", () => this.requestUpdate()),
      editing.state.shortcuts.subscribe(() => this.requestUpdate())
    ];
  }

  override render() {
    if (this.editing === null) {
      return nothing;
    }

    const { shortcuts } = this.editing.state;
    const rotationTitle = [
      shortcuts.label(
        "Rotate counter-clockwise",
        "orient.rotateCounterClockwise"
      ),
      shortcuts.label("clockwise", "orient.rotateClockwise"),
      shortcuts.label("auto", "orient.autoRotation")
    ].join(", ");

    return html`
      <jolly-button-group
        aria-label="Rotation"
        title=${rotationTitle}
        .options=${kRotationOptions}
        .value=${this.#rotation.value}
        @jolly-change=${this.#rotation.commit}
      ></jolly-button-group>
      <jolly-toggle
        label="Flip Y"
        title=${shortcuts.label("Flip Y", "orient.flipVertical")}
        .value=${this.#flipY.value}
        @jolly-change=${this.#flipY.commit}
      ></jolly-toggle>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "brush-orientation": BrushOrientation;
  }
}
