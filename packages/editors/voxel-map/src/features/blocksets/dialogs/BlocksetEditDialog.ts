// Import Third-party Dependencies
import {
  html,
  css,
  nothing
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import type {
  Dialog,
  JollyChangeDetail
} from "@jolly-pixel/ui";
import { BlockTextures } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import type { BlocksetEntry } from "../BlocksetEntry.ts";
import { tileSizeSegments } from "../tileSizes.ts";
import "../blocksetIcons.ts";

// CONSTANTS
const kOffGridWarning = "Some blocks will not line up with the new tile " +
  "grid. They keep covering the same pixels.";

@customElement("blockset-edit-dialog")
export class BlocksetEditDialog extends WorkspaceElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 80px;
      --jolly-field-inset-end: 0;
    }

    .usage {
      margin: var(--jolly-space-2, 8px) 0 0;
      color: var(--jolly-text-muted);
      font-size: var(--jolly-font-size-sm, 12px);
    }

    .remove {
      margin-inline-end: auto;
    }

    .pending {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--jolly-space-2, 8px);
      padding: var(--jolly-space-2, 8px);
      border-radius: var(--jolly-radius-sm, 2px);
      background: color-mix(
        in oklab,
        var(--jolly-intent-warning-fill) 16%,
        transparent
      );
    }

    .pending p {
      flex: 1 1 24ch;
      margin: 0;
      line-height: 1.4;
    }
  `;

  @state()
  private declare _blocksetId: string | null;

  @state()
  private declare _pendingTileSize: number | null;

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  constructor() {
    super();
    this._blocksetId = null;
    this._pendingTileSize = null;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    return [
      workspace.blocksets.subscribe("change", this.#refresh),
      workspace.mapDocument.subscribe("blockRegistryChanged", this.#refresh),
      workspace.usage.subscribe("change", this.#refresh)
    ];
  }

  async open(
    blocksetId: string
  ): Promise<void> {
    if (this.workspace?.blocksets.entry(blocksetId) === undefined) {
      return;
    }

    this._blocksetId = blocksetId;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  get #entry(): BlocksetEntry | undefined {
    return this._blocksetId === null ?
      undefined :
      this.workspace?.blocksets.entry(this._blocksetId);
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const entry = this.#entry;

    return html`
      <jolly-dialog
        heading=${entry === undefined ? "Blockset" : `Blockset "${entry.label}"`}
        icon="blockset"
        @jolly-close=${this.#onClose}
      >
        ${entry === undefined ? nothing : this.#renderContent(workspace, entry)}

        <jolly-button
          slot="actions"
          class="remove"
          variant="danger"
          icon="trash"
          ?disabled=${entry === undefined}
          @click=${this.#remove}
        >Remove</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${this.#close}
        >Close</jolly-button>
      </jolly-dialog>
    `;
  }

  #renderContent(
    workspace: VoxelMapWorkspace,
    entry: BlocksetEntry
  ) {
    const { definition } = entry;
    const tileSize = workspace.blocksets.tileSizeOf(definition.id);
    const usage = workspace.usage.blocksetUsageOf(definition.id);
    const renamable = entry.assetId !== null;
    const pendingTileSize = this._pendingTileSize;

    return html`
      <div class="fields">
        <jolly-text
          label="Name"
          .value=${entry.label}
          ?disabled=${!renamable}
          description=${entry.assetId === null ? "Unlinked texture, read-only" : ""}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => {
            void this.#rename(entry, event.detail.value);
          }}
        ></jolly-text>
        <jolly-button-group
          label="Tile size"
          .options=${tileSizeSegments(tileSize)}
          .value=${pendingTileSize ?? tileSize}
          ?disabled=${tileSize === undefined}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
            this.#resize(entry, event.detail.value);
          }}
        ></jolly-button-group>
        ${pendingTileSize === null ? nothing : html`
          <div class="pending" role="alert">
            <jolly-icon name="warning"></jolly-icon>
            <p>${kOffGridWarning}</p>
            <jolly-button
              @click=${() => {
                this._pendingTileSize = null;
              }}
            >Keep ${tileSize}</jolly-button>
            <jolly-button
              variant="accent"
              @click=${() => this.#applyPendingTileSize(entry)}
            >Resize to ${pendingTileSize}</jolly-button>
          </div>
        `}
      </div>
      <p class="usage">${usage.summary}</p>
    `;
  }

  readonly #refresh = (): void => {
    if (this._blocksetId === null) {
      return;
    }
    if (this.#entry === undefined) {
      this.#close();
    }
    this.requestUpdate();
  };

  async #rename(
    entry: BlocksetEntry,
    name: string
  ): Promise<void> {
    try {
      await this.workspace?.blocksets.rename(entry.definition.id, name);
    }
    catch (error) {
      this.workspace?.state.log.push(`Could not rename "${entry.label}": ${messageOf(error)}`);
    }
    this.requestUpdate();
  }

  #resize(
    entry: BlocksetEntry,
    tileSize: number
  ): void {
    const workspace = this.workspace;
    const { definition } = entry;
    const from = workspace?.blocksets.tileSizeOf(definition.id);
    if (workspace === null || from === undefined) {
      return;
    }

    this._pendingTileSize = null;
    if (tileSize === from) {
      return;
    }

    const rescale = {
      blocksetId: definition.id,
      from,
      to: tileSize
    };
    const offGrid = [...workspace.mapDocument.blocks].some(
      (block) => !BlockTextures.of(block).staysOnGrid(rescale)
    );
    if (offGrid) {
      this._pendingTileSize = tileSize;

      return;
    }

    workspace.blocksets.resizeTiles(definition.id, tileSize);
    this.requestUpdate();
  }

  #applyPendingTileSize(
    entry: BlocksetEntry
  ): void {
    const tileSize = this._pendingTileSize;
    this._pendingTileSize = null;
    if (tileSize !== null) {
      this.workspace?.blocksets.resizeTiles(entry.definition.id, tileSize);
    }
  }

  async #remove(): Promise<void> {
    const workspace = this.workspace;
    const entry = this.#entry;
    if (workspace === null || entry === undefined) {
      return;
    }

    const usage = workspace.usage.blocksetUsageOf(entry.definition.id);
    const confirmed = usage.unused ||
      await this._dialog.confirmInline({
        message: `Remove "${entry.label}"? ` +
          `${usage.removalMessage} The blockset asset is kept.`,
        confirmLabel: "Remove",
        danger: true
      });
    if (confirmed && workspace.blocksets.remove(entry.definition.id)) {
      this.#close();
    }
  }

  #close(): void {
    this._dialog.close();
  }

  #onClose(): void {
    this._blocksetId = null;
    this._pendingTileSize = null;
  }
}

function messageOf(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

declare global {
  interface HTMLElementTagNameMap {
    "blockset-edit-dialog": BlocksetEditDialog;
  }
}
