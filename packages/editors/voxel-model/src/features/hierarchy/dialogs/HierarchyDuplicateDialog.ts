// Import Third-party Dependencies
import {
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { state } from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/toggle";
import type { MirrorAxes } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  EditorDialog,
  type EditorDialogFrame
} from "../../../shared/dialogs/EditorDialog.ts";
import {
  NameDraft,
  type NameFieldOptions
} from "../../../shared/dialogs/NameDraft.ts";

// CONSTANTS
const kAxes = ["x", "y", "z"] as const;

type MirrorAxis = typeof kAxes[number];

export interface HierarchyDuplicateContext extends NameFieldOptions {
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
    .mirror {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-1, 4px);
      padding-inline: var(--jolly-field-inset-start, var(--jolly-space-1, 4px))
        var(--jolly-field-inset-end, var(--jolly-space-1, 4px));
    }

    .mirror-title {
      color: var(--jolly-text-muted);
      user-select: none;
    }

    .mirror-axes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--jolly-space-1, 4px);
    }

    .mirror-axes jolly-toggle {
      --jolly-field-inset-start: 0px;
      --jolly-field-inset-end: 0px;
    }
  `;

  @state()
  declare private draft: NameDraft;

  @state()
  declare private hasChildren: boolean;

  @state()
  declare private includeChildren: boolean;

  @state()
  declare private mirrorAxes: MirrorAxes;

  constructor() {
    super();
    this.draft = new NameDraft("");
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
      confirmVariant: "accent",
      confirmDisabled: this.draft.error !== null
    };
  }

  protected reset(
    context: HierarchyDuplicateContext
  ): void {
    this.draft = NameDraft.from(context);
    this.hasChildren = context.hasChildren;
    this.includeChildren = true;
    this.mirrorAxes = {
      x: false,
      y: false,
      z: false
    };
  }

  protected override canConfirm(): boolean {
    this.draft = this.draft.revalidate();

    return this.draft.error === null;
  }

  protected result(): HierarchyDuplicateResult {
    return {
      name: this.draft.name,
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
        .value=${this.draft.text}
        .error=${this.draft.error}
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
      <div
        class="mirror"
        role="group"
        aria-labelledby="mirror-title"
      >
        <span id="mirror-title" class="mirror-title">Mirror axis</span>
        <div class="mirror-axes">
          ${kAxes.map((axis) => html`
            <jolly-toggle
              label=${axis.toUpperCase()}
              .value=${this.mirrorAxes[axis]}
              @jolly-change=${(event: CustomEvent<JollyChangeDetail<boolean>>) => {
                this.#mirror(axis, event.detail.value);
              }}
            ></jolly-toggle>
          `)}
        </div>
      </div>
    `;
  }

  #onName(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.draft = this.draft.edit(event.detail.value);
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
