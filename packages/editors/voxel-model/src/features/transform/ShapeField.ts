// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  SubscriptionController,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import {
  BlockShape,
  type BlockNodeJSON,
  type BlockShapeJSON,
  type BlockShapeParameter,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import "../../shared/shapeIcons.ts";
import {
  BLOCK_SHAPE_OPTIONS,
  blockShapeById,
  blockShapeEntryOf,
  type BlockShapeEntryId
} from "../../shared/blockShapes.ts";
import type { ModelHierarchy } from "../../model/index.ts";
import type { BlockSelectionStore } from "../../state/index.ts";
import type { TransformLock } from "./index.ts";
import type { ModelAccessSignals } from "../../access/ModelAccess.ts";

// CONSTANTS
const kParameterLabels: Readonly<Record<BlockShapeParameter, string>> = {
  sides: "Sides",
  ringSides: "Ring sides",
  thickness: "Thickness"
};

export interface ShapeFieldWorkspace {
  access: ModelAccessSignals;
  document: ModelDocument;
  selection: BlockSelectionStore;
  hierarchy: Pick<ModelHierarchy, "reshape">;
  lock: TransformLock;
}

export class ShapeField extends LitElement {
  #connection = new SubscriptionController<ShapeFieldWorkspace>(
    this,
    (workspace) => this.#subscribeTo(workspace)
  );

  #refresh = (): void => {
    this.requestUpdate();
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 10ch;
    }

    .shape-icon {
      flex: 0 0 auto;
      width: 16px;
      height: 16px;
    }

    jolly-select {
      flex: 1 1 0;
      min-width: 0;
    }
  `;

  get #workspace(): ShapeFieldWorkspace | null {
    return this.#connection.current;
  }

  get #disabled(): boolean {
    const workspace = this.#workspace;
    const block = this.#selectedBlock();

    return workspace === null ||
      block === undefined ||
      !workspace.access.current.has("transforms") ||
      workspace.lock.lockedBy(block.id) !== null;
  }

  attach(
    workspace: ShapeFieldWorkspace
  ): void {
    this.#connection.attach(workspace);
  }

  override render(): TemplateResult {
    const shape = this.#shape();
    const entry = blockShapeEntryOf(shape);

    return html`
      <jolly-separator label="Geometry"></jolly-separator>
      <jolly-property-row label="Shape">
        <jolly-icon
          class="shape-icon"
          name=${entry.icon}
          aria-hidden="true"
        ></jolly-icon>
        <jolly-select
          title="Shape"
          .options=${BLOCK_SHAPE_OPTIONS}
          .value=${entry.id}
          ?disabled=${this.#disabled}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<BlockShapeEntryId>>) => {
            this.#reshape(blockShapeById(event.detail.value).shape);
          }}
        ></jolly-select>
      </jolly-property-row>
      ${BlockShape.parameters(shape).map(({ key, value, min, max, step }) => html`
        <jolly-number
          label=${kParameterLabels[key]}
          min=${min}
          max=${max}
          step=${step}
          ?disabled=${this.#disabled}
          .value=${value}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
            this.#reshape(BlockShape.withParameter(shape, key, event.detail.value));
          }}
        ></jolly-number>
      `)}
    `;
  }

  #selectedBlock(): BlockNodeJSON | undefined {
    const workspace = this.#workspace;
    const id = workspace?.selection.selected ?? null;

    return id === null ? undefined : workspace?.document.tree.block(id);
  }

  #shape(): BlockShapeJSON {
    const block = this.#selectedBlock();

    return block === undefined ? BlockShape.box : BlockShape.of(block);
  }

  #reshape(
    shape: BlockShapeJSON
  ): void {
    const id = this.#workspace?.selection.selected ?? null;
    if (id !== null) {
      this.#workspace?.hierarchy.reshape(id, shape);
    }
  }

  #subscribeTo(
    workspace: ShapeFieldWorkspace
  ): Array<() => void> {
    const { access, document, selection, lock } = workspace;

    return [
      access.subscribe("change", this.#refresh),
      document.subscribe("change", this.#refresh),
      document.subscribe("reset", this.#refresh),
      selection.subscribe("select", this.#refresh),
      lock.subscribe("change", this.#refresh)
    ];
  }
}

customElements.define("jolly-model-editor-shape", ShapeField);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-shape": ShapeField;
  }
}
