// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement, state } from "lit/decorators.js";
import type { KeyChordString } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { placementToolbarStyles } from "./PlacementToolbar.styles.ts";
import { PlacementSummary } from "./PlacementSummary.ts";
import { PLACEMENT_SHORTCUTS } from "./placementShortcuts.ts";
import {
  PLACEMENT_MIRRORS,
  PLACEMENT_ROTATIONS,
  type PlacementAxis,
  type PlacementTransform
} from "./placementTransforms.ts";

@customElement("voxel-placement-toolbar")
export class PlacementToolbar extends WorkspaceElement {
  static override styles = placementToolbarStyles;

  @state()
  declare _summary: PlacementSummary | null;

  constructor() {
    super();
    this._summary = null;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { placement, mapDocument } = workspace;
    const { selection, keyboardLayout } = workspace.state;
    const { world } = workspace.view.document;
    const refresh = (): void => {
      const current = placement.store.placement;
      this._summary = current === null ?
        null :
        PlacementSummary.of(current, world, placement.target);
      this.hidden = current === null;
    };

    refresh();

    return [
      placement.store.subscribe("change", refresh),
      selection.subscribe("change", refresh),
      mapDocument.subscribe("templatesChanged", refresh),
      mapDocument.subscribe("layerUpdated", refresh),
      keyboardLayout.subscribe("change", () => this.requestUpdate())
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const summary = this._summary;
    if (summary === null) {
      return nothing;
    }

    return html`
      <jolly-rail
        orientation="horizontal"
        role="toolbar"
        aria-label="Placement"
        @mousedown=${keepFocus}
      >
        <div class="group" role="group" aria-label="Rotate">
          ${PLACEMENT_ROTATIONS.map((rotation) => this.#renderTransform(
            rotation,
            `${rotation.title} (${this.#shortcut(rotation.chords)})`
          ))}
        </div>
        <span class="separator" aria-hidden="true"></span>
        <div class="group" role="group" aria-label="Mirror">
          ${PLACEMENT_MIRRORS.map((mirror) => this.#renderTransform(
            mirror,
            mirror.title,
            axisBadge(mirror.axis)
          ))}
        </div>
        <span class="separator" aria-hidden="true"></span>
        <div class="group" role="group" aria-label="Finish">
          <jolly-tool-button
            data-tool="commit"
            icon="check"
            label=${summary.commitLabel(this.#shortcut(PLACEMENT_SHORTCUTS.commit))}
            ?disabled=${!summary.committable}
            @click=${this.#onCommit}
          ></jolly-tool-button>
          <jolly-tool-button
            data-tool="cancel"
            icon="close"
            label=${`Cancel (${this.#shortcut(PLACEMENT_SHORTCUTS.cancel)})`}
            @click=${this.#onCancel}
          ></jolly-tool-button>
        </div>
        <span class="separator" aria-hidden="true"></span>
        <span
          class="caption"
          role="status"
          title="Drag to move, Shift + drag to lift"
        >
          <jolly-icon name=${summary.icon}></jolly-icon>
          <span>${summary.caption}</span>
        </span>
      </jolly-rail>
    `;
  }

  #renderTransform(
    placementTransform: PlacementTransform,
    label: string,
    badge: TemplateResult | typeof nothing = nothing
  ): TemplateResult {
    return html`
      <jolly-tool-button
        icon=${placementTransform.icon}
        label=${label}
        @click=${() => this.attached.placement.store.transform(
          placementTransform.transform
        )}
      >${badge}</jolly-tool-button>
    `;
  }

  #shortcut(
    chords: readonly KeyChordString[]
  ): string {
    return this.attached.state.keyboardLayout.format(chords[0]);
  }

  #onCommit(): void {
    this.attached.placement.commit();
  }

  #onCancel(): void {
    this.attached.placement.cancel();
  }
}

function axisBadge(
  axis: PlacementAxis
): TemplateResult {
  return html`
    <span class="axis" aria-hidden="true"><span class=${axis}>${axis.toUpperCase()}</span></span>
  `;
}

function keepFocus(
  event: MouseEvent
): void {
  event.preventDefault();
}

declare global {
  interface HTMLElementTagNameMap {
    "voxel-placement-toolbar": PlacementToolbar;
  }
}
