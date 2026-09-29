// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";
import { PLACEMENT_TRANSFORMS } from "./placementTransforms.ts";

@customElement("placement-actions")
export class PlacementActions extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    .transforms {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
      gap: var(--jolly-row-gap, 4px);
    }

    .actions {
      display: flex;
      gap: var(--jolly-row-gap, 4px);
    }

    .actions jolly-button {
      flex: 1 1 0;
    }

    .hint {
      margin: 0;
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare placement: MapPlacement;

  @property({ attribute: false })
  declare target: string | null;

  constructor() {
    super();
    this.target = null;
  }

  override render() {
    const { target } = this;
    const commitLabel = target === null ?
      "Commit" :
      `Commit into ${target}`;

    return html`
      <div class="transforms" @mousedown=${keepFocus}>
        ${PLACEMENT_TRANSFORMS.map(({ icon, title, transform }) => html`
          <jolly-button
            icon=${icon}
            label=${title}
            title=${title}
            @click=${() => this.placement.store.transform(transform)}
          ></jolly-button>
        `)}
      </div>

      <div class="actions" @mousedown=${keepFocus}>
        <jolly-button
          variant="accent"
          icon="check"
          label=${commitLabel}
          title=${target === null ? "Add a voxel layer first" : `${commitLabel} (Enter)`}
          ?disabled=${target === null}
          @click=${() => this.placement.commit()}
        >Commit</jolly-button>
        <jolly-button
          icon="close"
          label="Cancel"
          title="Cancel (Esc)"
          @click=${() => this.placement.cancel()}
        >Cancel</jolly-button>
      </div>

      <p class="hint">Drag to move, Shift + drag to lift.</p>
    `;
  }
}

function keepFocus(
  event: MouseEvent
): void {
  event.preventDefault();
}

declare global {
  interface HTMLElementTagNameMap {
    "placement-actions": PlacementActions;
  }
}
