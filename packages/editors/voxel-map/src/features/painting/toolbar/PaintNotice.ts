// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement, state } from "lit/decorators.js";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import {
  PaintAvailability,
  type PaintingNotice
} from "./PaintAvailability.ts";
import { paintNoticeStyles } from "./PaintNotice.styles.ts";

@customElement("voxel-paint-notice")
export class PaintNotice extends WorkspaceElement {
  static override styles = paintNoticeStyles;

  @state()
  declare _notice: PaintingNotice | null;

  constructor() {
    super();
    this._notice = null;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    return PaintAvailability.watch(workspace, (availability) => {
      this._notice = availability.notice;
      this.hidden = availability.notice === null;
    });
  }

  override render(): TemplateResult | typeof nothing {
    const notice = this._notice;
    if (notice === null) {
      return nothing;
    }

    const { resumeLayer } = notice;

    return html`
      <div class="notice" role="status">
        <jolly-icon name="warning"></jolly-icon>
        <span>${notice.message}</span>
        ${resumeLayer === null ? nothing : html`
          <button
            type="button"
            @click=${() => this.#resume(resumeLayer)}
          >Paint on ${resumeLayer}</button>
        `}
      </div>
    `;
  }

  #resume(
    layerName: string
  ): void {
    this.attached.state.selection.selectVoxelLayer(layerName);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "voxel-paint-notice": PaintNotice;
  }
}
