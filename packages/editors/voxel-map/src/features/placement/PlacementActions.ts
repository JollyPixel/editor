// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  nothing
} from "lit";
import { customElement, property } from "lit/decorators.js";

// Import Internal Dependencies
import type { KeyboardLayoutStore } from "../../state/index.ts";
import type { MapPlacement } from "./MapPlacement.ts";
import {
  PLACEMENT_TRANSFORMS,
  type PlacementTransform
} from "./placementTransforms.ts";

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

    .axis {
      font-weight: 600;
      letter-spacing: 0.1em;
    }

    .axis.x {
      color: var(--jolly-tone-coral);
    }

    .axis.y {
      color: var(--jolly-tone-lime);
    }

    .axis.z {
      color: var(--jolly-tone-sky);
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
  declare keyboardLayout: KeyboardLayoutStore;

  @property({ attribute: false })
  declare target: string | null;

  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.target = null;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#unsubscribe = this.keyboardLayout.subscribe(
      "change",
      () => this.requestUpdate()
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  override render() {
    const { target } = this;
    const commitLabel = target === null ?
      "Commit" :
      `Commit into ${target}`;

    return html`
      <div class="transforms" @mousedown=${keepFocus}>
        ${PLACEMENT_TRANSFORMS.map((placementTransform) => {
          const label = this.#labelOf(placementTransform);
          const { axis } = placementTransform;

          return html`
            <jolly-button
              icon=${placementTransform.icon}
              label=${label}
              title=${label}
              @click=${() => this.placement.store.transform(
                placementTransform.transform
              )}
            >${axis === null ?
              nothing :
              html`<span class="axis ${axis}" aria-hidden="true">${axis.toUpperCase()}</span>`}</jolly-button>
          `;
        })}
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

  #labelOf(
    placementTransform: PlacementTransform
  ): string {
    const { title, shortcut } = placementTransform;

    return shortcut === null ?
      title :
      `${title} (${this.keyboardLayout.format(shortcut)})`;
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
