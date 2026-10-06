// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  isApplePlatform,
  type KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { MARQUEE_SHORTCUTS } from "../marquee/marqueeShortcuts.ts";
import type { ActivePlacement } from "./ActivePlacement.ts";
import { CLIPBOARD_SHORTCUTS } from "./clipboardShortcuts.ts";
import { placementControlsStyles } from "./PlacementControls.styles.ts";
import { PLACEMENT_SHORTCUTS } from "./placementShortcuts.ts";
import {
  PLACEMENT_MIRRORS,
  PLACEMENT_ROTATIONS,
  type PlacementAxis,
  type PlacementTransform
} from "./placementTransforms.ts";
import "./placementIcons.ts";
import "../marquee/marqueeIcons.ts";

@customElement("voxel-placement-controls")
export class PlacementControls extends WorkspaceElement {
  static override styles = placementControlsStyles;

  @state()
  declare _current: ActivePlacement | null;

  @state()
  declare _canPaste: boolean;

  constructor() {
    super();
    this._current = null;
    this._canPaste = false;
    this.addEventListener("mousedown", keepFocus);
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { placement } = workspace;
    const refresh = (current: ActivePlacement | null): void => {
      this._current = current ?? this._current;
    };

    refresh(placement.current);
    this._canPaste = placement.clipboard.content !== null;

    return [
      placement.subscribe("change", refresh),
      placement.clipboard.subscribe("change", (content) => {
        this._canPaste = content !== null;
      }),
      workspace.state.keyboardLayout.subscribe(
        "change",
        () => this.requestUpdate()
      )
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const current = this._current;
    if (current === null) {
      return nothing;
    }

    return html`
      <span
        class="caption"
        role="status"
        title=${`Drag to move, ${isApplePlatform() ? "⌘" : "Ctrl"} + drag to lift`}
      >
        <jolly-icon name=${current.icon}></jolly-icon>
        <span>${current.caption}</span>
      </span>
      <span class="separator" aria-hidden="true"></span>
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
      <div class="group" role="group" aria-label="Clipboard">
        <jolly-tool-button
          data-tool="copy"
          icon="copy"
          label=${`Copy (${this.#shortcut(CLIPBOARD_SHORTCUTS.copy)})`}
          @click=${this.#onCopy}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="paste"
          icon="paste"
          label=${`Paste (${this.#shortcut(CLIPBOARD_SHORTCUTS.paste)})`}
          ?disabled=${!this._canPaste}
          @click=${this.#onPaste}
        ></jolly-tool-button>
      </div>
      <span class="separator" aria-hidden="true"></span>
      <div class="group" role="group" aria-label="Finish">
        ${current.deletable ? html`
          <jolly-tool-button
            data-tool="delete"
            icon="trash"
            label=${`Delete blocks (${this.#shortcut(MARQUEE_SHORTCUTS.delete)})`}
            @click=${this.#onDelete}
          ></jolly-tool-button>
        ` : nothing}
        <jolly-tool-button
          data-tool="commit"
          icon="check"
          label=${current.commitLabel(this.#shortcut(PLACEMENT_SHORTCUTS.commit))}
          ?disabled=${!current.committable}
          @click=${this.#onCommit}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="cancel"
          icon="close"
          label=${`Cancel (${this.#shortcut(PLACEMENT_SHORTCUTS.cancel)})`}
          @click=${this.#onCancel}
        ></jolly-tool-button>
      </div>
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
        @click=${() => this.attached.placement.turn(
          placementTransform.transform
        )}
      >${badge}</jolly-tool-button>
    `;
  }

  #shortcut(
    chords: readonly KeyChordString[]
  ): string {
    return this.attached.state.keyboardLayout.format(
      chords[0]
    );
  }

  #onCommit(): void {
    this.attached.placement.commit();
  }

  #onCopy(): void {
    this.attached.placement.copy();
  }

  #onPaste(): void {
    const workspace = this.attached;
    workspace.placement.paste(workspace.focusPoint());
  }

  #onDelete(): void {
    this.attached.placement.deleteRegion();
  }

  #onCancel(): void {
    this.attached.placement.cancel();
  }
}

function axisBadge(
  axis: PlacementAxis
): TemplateResult {
  return html`
    <span class="axis" aria-hidden="true">
      <span class=${axis}>${axis.toUpperCase()}</span>
    </span>
  `;
}

function keepFocus(
  event: MouseEvent
): void {
  event.preventDefault();
}

declare global {
  interface HTMLElementTagNameMap {
    "voxel-placement-controls": PlacementControls;
  }
}
