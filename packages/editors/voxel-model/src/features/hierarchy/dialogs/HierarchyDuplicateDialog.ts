// Import Third-party Dependencies
import {
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { state } from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import type { MirrorAxes } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  EditorDialog,
  type EditorDialogFrame
} from "../../../shared/EditorDialog.ts";

// CONSTANTS
const kAxes = ["x", "y", "z"] as const;

type MirrorAxis = typeof kAxes[number];

export interface HierarchyDuplicateContext {
  defaultName: string;
  hasChildren: boolean;
}

export interface HierarchyDuplicateResult {
  name: string;
  includeChildren: boolean;
  mirrorAxes: MirrorAxes;
}

export class HierarchyDuplicateDialog extends EditorDialog<
  HierarchyDuplicateContext,
  HierarchyDuplicateResult
> {
  static override styles = css`
    .mirror-title {
      color: var(--jolly-text-muted);
      font-size: 0.85em;
    }

    .mirror-axes {
      display: flex;
      gap: var(--jolly-space-4, 16px);
    }
  `;

  @state()
  declare private name: string;

  @state()
  declare private hasChildren: boolean;

  @state()
  declare private includeChildren: boolean;

  @state()
  declare private mirrorAxes: MirrorAxes;

  constructor() {
    super();
    this.name = "";
    this.hasChildren = false;
    this.includeChildren = true;
    this.mirrorAxes = {
      x: false,
      y: false,
      z: false
    };
  }

  protected get frame(): EditorDialogFrame {
    return {
      heading: "Duplicate",
      icon: "action-duplicate",
      confirmLabel: "Duplicate",
      confirmVariant: "accent"
    };
  }

  protected reset(
    context: HierarchyDuplicateContext
  ): void {
    this.name = context.defaultName;
    this.hasChildren = context.hasChildren;
    this.includeChildren = true;
    this.mirrorAxes = {
      x: false,
      y: false,
      z: false
    };
  }

  protected result(): HierarchyDuplicateResult {
    return {
      name: this.name.trim(),
      includeChildren: this.hasChildren && this.includeChildren,
      mirrorAxes: { ...this.mirrorAxes }
    };
  }

  protected focusTarget(): HTMLElement | null {
    return this.renderRoot.querySelector("jolly-text");
  }

  protected renderFields(): TemplateResult {
    return html`
      <jolly-text
        label="Name"
        .value=${this.name}
        @jolly-input=${this.#onName}
        @jolly-change=${this.#onName}
      ></jolly-text>
      ${this.hasChildren ? html`
        <jolly-checkbox
          label="Duplicate children too"
          .value=${this.includeChildren}
          @jolly-change=${this.#onIncludeChildren}
        ></jolly-checkbox>
      ` : nothing}
      <div class="mirror-title">Mirror axis</div>
      <div class="mirror-axes">
        ${kAxes.map((axis) => html`
          <jolly-checkbox
            label=${axis.toUpperCase()}
            .value=${this.mirrorAxes[axis]}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<boolean>>) => {
              this.#mirror(axis, event.detail.value);
            }}
          ></jolly-checkbox>
        `)}
      </div>
    `;
  }

  #onName(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.name = event.detail.value;
  }

  #onIncludeChildren(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this.includeChildren = event.detail.value;
  }

  #mirror(
    axis: MirrorAxis,
    mirrored: boolean
  ): void {
    this.mirrorAxes = {
      ...this.mirrorAxes,
      [axis]: mirrored
    };
  }
}

customElements.define("jolly-model-editor-duplicate-dialog", HierarchyDuplicateDialog);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-duplicate-dialog": HierarchyDuplicateDialog;
  }
}
