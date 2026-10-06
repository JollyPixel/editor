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

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import type { RotationMode } from "../BrushStore.ts";

// CONSTANTS
const kRotationOptions: JollyOption<RotationMode>[] = [
  { label: "Auto", value: "auto" },
  { label: "0°", value: VoxelRotation.None },
  { label: "CCW 90°", value: VoxelRotation.CCW90 },
  { label: "180°", value: VoxelRotation.Deg180 },
  { label: "CW 90°", value: VoxelRotation.CW90 }
];

@customElement("brush-orientation")
export class BrushOrientation extends WorkspaceElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }

    jolly-button-group {
      flex: 1 1 auto;
      min-width: 0;
    }

    jolly-checkbox {
      --jolly-label-width: auto;
      --jolly-label-max-width: none;

      flex: 0 0 auto;
      margin-inline-start: auto;
    }
  `;

  #rotation = new FieldBinding<RotationMode>(this, {
    read: () => this.attached.brush.rotationMode,
    write: (value) => {
      this.attached.brush.rotationMode = value;
    }
  });

  #flipY = new FieldBinding<boolean>(this, {
    read: () => this.attached.brush.flipY,
    write: (value) => {
      this.attached.brush.flipY = value;
    }
  });

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    return [
      workspace.brush.subscribe("change", () => this.requestUpdate())
    ];
  }

  override render() {
    if (this.workspace === null) {
      return nothing;
    }

    return html`
      <jolly-button-group
        aria-label="Rotation"
        .options=${kRotationOptions}
        .value=${this.#rotation.value}
        @jolly-change=${this.#rotation.commit}
      ></jolly-button-group>
      <jolly-checkbox
        align="end"
        label="Flip Y"
        .value=${this.#flipY.value}
        @jolly-change=${this.#flipY.commit}
      ></jolly-checkbox>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "brush-orientation": BrushOrientation;
  }
}
