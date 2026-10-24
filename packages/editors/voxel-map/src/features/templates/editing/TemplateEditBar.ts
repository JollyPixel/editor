// Import Third-party Dependencies
import {
  html,
  css,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../../editing/EditingElement.ts";
import "../templateIcons.ts";

@customElement("voxel-template-edit-bar")
export class TemplateEditBar extends EditingElement {
  static override styles = css`
    :host {
      display: inline-flex;
    }

    :host([hidden]) {
      display: none;
    }

    .bar {
      --jolly-icon-size: 14px;

      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 4px 4px 8px;
      border-radius: var(--jolly-radius-sm, 2px);
      background: var(--jolly-surface-raised);
      box-shadow: var(--jolly-shadow-floating);
      color: var(--jolly-text);
      font-size: 11px;
      white-space: nowrap;
    }

    .caption {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 28ch;
      margin-inline-end: 4px;
    }

    .caption span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  @state()
  declare _name: string | null;

  constructor() {
    super();
    this._name = null;
    this.hidden = true;
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const { templateEditing, editorMap } = editing;
    const refresh = (): void => {
      this._name = templateEditing.current?.template.name ?? null;
      this.hidden = this._name === null;
    };
    refresh();

    return [
      editing.state.editContext.subscribe("change", refresh),
      editorMap.subscribe("templatesChanged", refresh),
      editing.access.subscribe("change", () => this.requestUpdate())
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const name = this._name;
    if (name === null) {
      return nothing;
    }

    const { templateEditing } = this.attached;

    return html`
      <div class="bar" role="toolbar" aria-label="Template editing">
        <span class="caption" role="status">
          <jolly-icon name="template"></jolly-icon>
          <span>Editing ${name}</span>
        </span>
        <jolly-button
          data-action="apply"
          variant="accent"
          title="Save the draft into the template for everyone"
          ?disabled=${!templateEditing.canApply}
          @click=${this.#onApply}
        >Apply</jolly-button>
        <jolly-button
          data-action="done"
          title="Go back to the map"
          @click=${this.#onDone}
        >Done</jolly-button>
        <jolly-button
          data-action="discard"
          icon="trash"
          icon-only
          variant="danger"
          label="Discard draft"
          title="Discard the changes not applied yet"
          ?disabled=${!templateEditing.canDiscard}
          @click=${this.#onDiscard}
        ></jolly-button>
      </div>
    `;
  }

  #onApply(): void {
    this.attached.templateEditing.apply();
  }

  #onDone(): void {
    this.attached.templateEditing.close();
  }

  async #onDiscard(): Promise<void> {
    await this.attached.templateEditing.discard();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "voxel-template-edit-bar": TemplateEditBar;
  }
}
