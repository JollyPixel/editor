// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type {
  JollyActivateDetail,
  JollyRenameDetail,
  JollySelectDetail,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/index.ts";
import type { TemplateStore } from "../../state/index.ts";
import { ViewFocus } from "../../scene/viewFocus.ts";
import {
  beginTemplatePlacement,
  renameTemplate
} from "./templateActions.ts";
import { templateTreeNodes } from "./templateTree.ts";

@customElement("template-manager")
export class TemplateManager extends LitElement {
  static override styles = css`
    :host {
      display: block;
      overflow-y: auto;
    }

    jolly-tree {
      margin-inline: var(--jolly-space-1, 4px);
    }

    .hint {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare world: VoxelWorld;

  @property({ attribute: false })
  declare templates: TemplateStore;

  @property({ attribute: false })
  declare mapDocument: MapDocumentSignals;

  @property({ attribute: false })
  declare viewFocus: ViewFocus;

  @state()
  private declare _nodes: TreeNode<string>[];

  @state()
  private declare _selected: string[];

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.viewFocus = new ViewFocus();
    this._nodes = [];
    this._selected = [];
  }

  override willUpdate(
    changedProperties: Map<string | symbol, unknown>
  ): void {
    if (changedProperties.has("world")) {
      this.#refreshNodes();
    }
  }

  override connectedCallback() {
    super.connectedCallback();

    this.#subscriptions.push(
      this.mapDocument.subscribe("templatesChanged", this.#refreshNodes),
      this.templates.subscribe("selectionChange", this.#onSelectionChange)
    );
    this.#onSelectionChange(this.templates.selected);
    this.#refreshNodes();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  override render() {
    if (this._nodes.length === 0) {
      return html`<p class="hint">
        Select a voxel layer and save it to create a template.
      </p>`;
    }

    return html`
      <jolly-tree
        renamable
        activate-on-double-click
        .nodes=${this._nodes}
        .selected=${this._selected}
        @jolly-select=${this.#onSelect}
        @jolly-rename=${this.#onRename}
        @jolly-activate=${this.#onActivate}
      ></jolly-tree>
    `;
  }

  place(): void {
    const templateId = this.templates.selected;
    if (templateId === null) {
      return;
    }

    beginTemplatePlacement(
      this.world,
      this.templates,
      templateId,
      this.viewFocus.point
    );
  }

  readonly #refreshNodes = (): void => {
    this._nodes = templateTreeNodes(this.world.templates);
  };

  readonly #onSelectionChange = (
    templateId: string | null
  ): void => {
    this._selected = templateId === null ? [] : [templateId];
  };

  #onSelect(
    event: CustomEvent<JollySelectDetail>
  ): void {
    const [id] = event.detail.selected;
    this.templates.selected = id ?? null;
  }

  #onRename(
    event: CustomEvent<JollyRenameDetail>
  ): void {
    renameTemplate(this.world, event.detail.id, event.detail.name);
    this.#refreshNodes();
  }

  #onActivate(
    event: CustomEvent<JollyActivateDetail>
  ): void {
    this.templates.selected = event.detail.id;
    this.place();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "template-manager": TemplateManager;
  }
}
