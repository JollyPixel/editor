// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import type { KeyChordString } from "@jolly-pixel/controls";
import type { HistoryScopeState } from "@jolly-pixel/history";

// Import Internal Dependencies
import type {
  EditorTool,
  SelectMode
} from "../../state/index.ts";
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { HISTORY_SHORTCUTS } from "../../shared/historyShortcuts.ts";
import { TOOL_SHORTCUTS } from "../../shared/toolShortcuts.ts";
import { CLIPBOARD_SHORTCUTS } from "../../features/placement/clipboardShortcuts.ts";
import { editToolbarStyles } from "./EditToolbar.styles.ts";
import "../../features/painting/toolbar/BrushControls.ts";
import "../../features/painting/toolbar/PaintNotice.ts";
import "../../features/placement/PlacementControls.ts";
import "../../features/marquee/marqueeIcons.ts";

export type EditMode = "paint" | "select" | "place";

@customElement("voxel-edit-toolbar")
export class EditToolbar extends WorkspaceElement {
  static override styles = editToolbarStyles;

  @property({ reflect: true })
  declare mode: EditMode;

  @state()
  declare _undoDepth: number;

  @state()
  declare _redoDepth: number;

  @state()
  declare _canPaste: boolean;

  @state()
  declare _selectMode: SelectMode;

  #onHistoryChange = (
    state: HistoryScopeState
  ): void => {
    this._undoDepth = state.undoCount;
    this._redoDepth = state.redoCount;
  };

  constructor() {
    super();
    this.mode = "paint";
    this._undoDepth = 0;
    this._redoDepth = 0;
    this._canPaste = false;
    this._selectMode = "box";
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { placement } = workspace;
    const { tool, keyboardLayout } = workspace.state;
    const { history } = workspace;
    const refreshMode = (): void => {
      if (placement.placing) {
        this.mode = "place";
      }
      else {
        this.mode = tool.selecting ? "select" : "paint";
      }
    };

    this.#onHistoryChange(history.state);
    this._canPaste = placement.clipboard.content !== null;
    this._selectMode = tool.selectMode;
    refreshMode();

    return [
      history.subscribe("change", this.#onHistoryChange),
      placement.subscribe("change", refreshMode),
      placement.clipboard.subscribe("change", (content) => {
        this._canPaste = content !== null;
      }),
      tool.subscribe("change", refreshMode),
      tool.subscribe("selectMode", (selectMode) => {
        this._selectMode = selectMode;
      }),
      keyboardLayout.subscribe("change", () => this.requestUpdate())
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const { mode } = this;

    return html`
      <voxel-paint-notice .workspace=${workspace}></voxel-paint-notice>
      <jolly-rail
        orientation="horizontal"
        role="toolbar"
        aria-label="Map editing"
      >
        ${renderSegment("edit", mode !== "place", this.#renderEdit())}
        ${renderSegment("select", mode === "select", this.#renderSelect())}
        ${renderSegment("brush", mode === "paint", html`
          <span class="separator" aria-hidden="true"></span>
          <voxel-brush-controls .workspace=${workspace}></voxel-brush-controls>
        `)}
        ${renderSegment("placement", mode === "place", html`
          <voxel-placement-controls
            .workspace=${workspace}
          ></voxel-placement-controls>
        `)}
      </jolly-rail>
    `;
  }

  #renderEdit(): TemplateResult {
    const selecting = this.mode === "select";

    return html`
      <div class="group" role="group" aria-label="Tools">
        <jolly-tool-button
          data-tool="brush"
          icon="pencil"
          label=${`Brush (${this.#shortcut(TOOL_SHORTCUTS.brush)})`}
          ?active=${!selecting}
          @click=${() => this.#selectTool("brush")}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="select"
          icon="marquee"
          label=${`Select (${this.#shortcut(TOOL_SHORTCUTS.select)})`}
          ?active=${selecting}
          @click=${() => this.#selectTool("select")}
        ></jolly-tool-button>
      </div>
      <span class="separator" aria-hidden="true"></span>
      <div class="group" role="group" aria-label="History">
        <jolly-tool-button
          data-tool="undo"
          icon="undo"
          label=${`Undo (${this.#shortcut(HISTORY_SHORTCUTS.undo)})`}
          ?disabled=${this._undoDepth === 0}
          @click=${this.#onUndo}
        >${renderStepCount(this._undoDepth)}</jolly-tool-button>
        <jolly-tool-button
          data-tool="redo"
          icon="redo"
          label=${`Redo (${this.#shortcut(HISTORY_SHORTCUTS.redo)})`}
          ?disabled=${this._redoDepth === 0}
          @click=${this.#onRedo}
        >${renderStepCount(this._redoDepth)}</jolly-tool-button>
      </div>
      <span class="separator" aria-hidden="true"></span>
      <div class="group" role="group" aria-label="Clipboard">
        <jolly-tool-button
          data-tool="paste"
          icon="paste"
          label=${`Paste (${this.#shortcut(CLIPBOARD_SHORTCUTS.paste)})`}
          ?disabled=${!this._canPaste}
          @click=${this.#onPaste}
        ></jolly-tool-button>
      </div>
    `;
  }

  #renderSelect(): TemplateResult {
    const connected = this._selectMode === "connected";
    const cycle = this.#shortcut(TOOL_SHORTCUTS.select);

    return html`
      <span class="separator" aria-hidden="true"></span>
      <div class="group" role="group" aria-label="Select mode">
        <jolly-tool-button
          data-select-mode="box"
          icon="marquee"
          label=${`Box select (${cycle})`}
          ?active=${!connected}
          @click=${() => this.#selectMode("box")}
        ></jolly-tool-button>
        <jolly-tool-button
          data-select-mode="connected"
          icon="select-connected"
          label=${`Connected select (${cycle})`}
          ?active=${connected}
          @click=${() => this.#selectMode("connected")}
        ></jolly-tool-button>
      </div>
    `;
  }

  #shortcut(
    chords: readonly KeyChordString[]
  ): string {
    return this.attached.state.keyboardLayout.format(chords[0]);
  }

  #selectTool(
    tool: EditorTool
  ): void {
    this.attached.state.tool.current = tool;
  }

  #selectMode(
    mode: SelectMode
  ): void {
    this.attached.state.tool.selectMode = mode;
  }

  #onUndo(): void {
    this.workspace?.history.undo();
  }

  #onRedo(): void {
    this.workspace?.history.redo();
  }

  #onPaste(): void {
    const workspace = this.attached;
    workspace.placement.paste(workspace.focusPoint());
  }
}

function renderSegment(
  name: string,
  shown: boolean,
  content: TemplateResult
): TemplateResult {
  return html`
    <div class="segment" data-segment=${name} ?inert=${!shown}>
      <div class="segment-content">${content}</div>
    </div>
  `;
}

function renderStepCount(
  depth: number
): TemplateResult | typeof nothing {
  return depth === 0 ?
    nothing :
    html`<span class="step-count" aria-hidden="true"><span>${depth}</span></span>`;
}

declare global {
  interface HTMLElementTagNameMap {
    "voxel-edit-toolbar": EditToolbar;
  }
}
