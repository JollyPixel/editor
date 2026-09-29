// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  VoxelTemplate,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { FieldBinding } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/index.ts";
import type { SelectionStore } from "../../state/index.ts";
import type { MapTemplates } from "./MapTemplates.ts";
import type { TemplatePlacement } from "./TemplatePlacement.ts";
import {
  propertiesOf,
  propertyRowsOf,
  type PropertyRow,
  type PropertyRowsChangeDetail
} from "../../shared/propertyDraft.ts";
import { positionSource } from "../../shared/positionSource.ts";
import { transformButtons } from "../../shared/transformButtons.ts";
import "../../shared/CustomPropertiesEditor.ts";

// CONSTANTS
const kPlacementTransforms = transformButtons("the pivot", {
  left: "Q",
  right: "E"
});

@customElement("template-panel")
export class TemplatePanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-1, 4px);
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--jolly-row-gap, 4px);
    }

    .hint {
      margin: 0;
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare world: VoxelWorld;

  @property({ attribute: false })
  declare templates: MapTemplates;

  @property({ attribute: false })
  declare selection: SelectionStore;

  @property({ attribute: false })
  declare mapDocument: MapDocumentSignals;

  @state()
  private declare _template: VoxelTemplate | null;

  @state()
  private declare _placement: TemplatePlacement | null;

  @state()
  private declare _props: PropertyRow[];

  #subscriptions: Array<() => void> = [];

  #position = new FieldBinding(this, positionSource({
    position: () => this._placement?.position ?? null,
    move: (position) => this.templates.store.movePlacement(position)
  }));

  constructor() {
    super();
    this._template = null;
    this._placement = null;
    this._props = [];
  }

  override connectedCallback() {
    super.connectedCallback();

    this.#subscriptions.push(
      this.templates.store.subscribe("selectionChange", this.#syncTemplate),
      this.templates.store.subscribe("placementChange", this.#syncPlacement),
      this.mapDocument.subscribe("templatesChanged", this.#syncTemplate),
      this.selection.subscribe("change", () => this.requestUpdate())
    );
    this.#syncTemplate();
    this.#syncPlacement(this.templates.store.placement);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  override render() {
    return html`
      ${this.#renderPlacement()}
      ${this.#renderTemplate()}
    `;
  }

  #renderPlacement() {
    const placement = this._placement;
    if (placement === null) {
      return nothing;
    }

    const template = this.world.templates.get(placement.templateId);
    const layerName = this.selection.lastVoxelLayer;

    return html`
      <jolly-separator
        label=${`Placing ${template?.name ?? ""}`}
      ></jolly-separator>

      <jolly-vector3
        label="Pivot"
        step="1"
        .value=${this.#position.value}
        @jolly-input=${this.#position.input}
        @jolly-change=${this.#position.commit}
      ></jolly-vector3>

      <div class="row">
        ${kPlacementTransforms.map(({ label, title, transform }) => html`
          <jolly-button
            title=${title}
            @click=${() => this.templates.store.transformPlacement(transform)}
          >${label}</jolly-button>
        `)}
      </div>

      <p class="hint">
        Drag the box to move it, Shift + drag to lift it.
      </p>

      <div class="row">
        <jolly-button
          variant="accent"
          icon="check"
          title=${layerName === null ? "Add a voxel layer first" : `Stamp into ${layerName}`}
          ?disabled=${layerName === null}
          @click=${this.#commit}
        >${layerName === null ? "Commit" : `Commit into ${layerName}`}</jolly-button>
        <jolly-button
          icon="close"
          @click=${() => this.templates.store.endPlacement()}
        >Cancel</jolly-button>
      </div>
    `;
  }

  #renderTemplate() {
    const template = this._template;
    if (template === null) {
      return nothing;
    }

    return html`
      <jolly-separator label=${template.name}></jolly-separator>

      <jolly-vector3
        label="Size"
        disabled
        .value=${{ ...template.size }}
      ></jolly-vector3>

      <custom-properties-editor
        .rows=${this._props}
        storage-key="voxel-map:folder:template-properties"
        @property-rows-change=${this.#onPropertyRowsChange}
      ></custom-properties-editor>
    `;
  }

  readonly #syncTemplate = (): void => {
    const templateId = this.templates.store.selected;
    const template = templateId === null ?
      undefined :
      this.world.templates.get(templateId);

    if (template?.id !== this._template?.id) {
      this._props = template === undefined ?
        [] :
        propertyRowsOf(template.properties);
    }
    this._template = template ?? null;
  };

  readonly #syncPlacement = (
    placement: TemplatePlacement | null
  ): void => {
    this._placement = placement;
  };

  readonly #commit = (): void => {
    this.templates.commitPlacement(this.selection.lastVoxelLayer);
  };

  #onPropertyRowsChange(
    event: CustomEvent<PropertyRowsChangeDetail>
  ): void {
    this._props = event.detail.rows;
    const template = this._template;
    if (template === null) {
      return;
    }

    this.world.templates.update(template.id, {
      properties: propertiesOf(this._props)
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "template-panel": TemplatePanel;
  }
}
