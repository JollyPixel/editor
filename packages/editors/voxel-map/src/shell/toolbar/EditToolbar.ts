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
import type { HistoryScopeState } from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  SELECT_MODES,
  type EditorTool,
  type SelectMode
} from "../../state/index.ts";
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../editing/EditingElement.ts";
import { editToolbarStyles } from "./EditToolbar.styles.ts";
import "../../features/painting/toolbar/BrushControls.ts";
import "../../features/painting/toolbar/PaintNotice.ts";
import "../../features/placement/PlacementControls.ts";
import "../../features/templates/editing/TemplateEditBar.ts";
import "../../features/marquee/marqueeIcons.ts";

// CONSTANTS
const kSelectModeButtons = {
  box: {
    icon: "marquee",
    label: "Box select"
  },
  corners: {
    icon: "select-corners",
    label: "Corner select"
  },
  connected: {
    icon: "select-connected",
    label: "Connected select"
  }
} as const satisfies Record<SelectMode, { icon: string; label: string; }>;

export type EditMode = "paint" | "select" | "place";

@customElement("voxel-edit-toolbar")
export class EditToolbar extends EditingElement {
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

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const { placement } = editing;
    const { tool, shortcuts } = editing.state;
    const { history } = editing;
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
      editing.access.subscribe("change", () => this.requestUpdate()),
      shortcuts.subscribe(() => this.requestUpdate())
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const editing = this.editing;
    if (editing === null) {
      return nothing;
    }

    const { mode } = this;

    return html`
      <voxel-template-edit-bar
        .editing=${editing}
      ></voxel-template-edit-bar>
      <voxel-paint-notice .editing=${editing}></voxel-paint-notice>
      <jolly-rail
        orientation="horizontal"
        role="toolbar"
        aria-label="Map editing"
      >
        ${renderSegment("edit", mode !== "place", this.#renderEdit())}
        ${renderSegment("select", mode === "select", this.#renderSelect())}
        ${renderSegment("brush", mode === "paint", html`
          <voxel-brush-controls .editing=${editing}></voxel-brush-controls>
        `)}
        ${renderSegment("placement", mode === "place", html`
          <voxel-placement-controls
            .editing=${editing}
          ></voxel-placement-controls>
        `)}
      </jolly-rail>
    `;
  }

  #renderEdit(): TemplateResult {
    const selecting = this.mode === "select";
    const { access, placement } = this.attached;
    const { shortcuts } = this.attached.state;

    return html`
      <div class="group" role="group" aria-label="Tools">
        <jolly-tool-button
          data-tool="brush"
          icon="pencil"
          label=${shortcuts.label("Brush", "tool.brush")}
          ?active=${!selecting}
          @click=${() => this.#selectTool("brush")}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="select"
          icon="marquee"
          label=${shortcuts.label("Select", "tool.select")}
          ?active=${selecting}
          @click=${() => this.#selectTool("select")}
        ></jolly-tool-button>
      </div>
      <div class="group divided" role="group" aria-label="History">
        <jolly-tool-button
          data-tool="undo"
          icon="undo"
          label=${shortcuts.label("Undo", "edit.undo")}
          ?disabled=${access.current.readOnly || this._undoDepth === 0}
          @click=${this.#onUndo}
        >${renderStepCount(this._undoDepth)}</jolly-tool-button>
        <jolly-tool-button
          data-tool="redo"
          icon="redo"
          label=${shortcuts.label("Redo", "edit.redo")}
          ?disabled=${access.current.readOnly || this._redoDepth === 0}
          @click=${this.#onRedo}
        >${renderStepCount(this._redoDepth)}</jolly-tool-button>
      </div>
      <div class="group divided" role="group" aria-label="Clipboard">
        <jolly-tool-button
          data-tool="paste"
          icon="paste"
          label=${shortcuts.label("Paste", "edit.paste")}
          ?disabled=${!placement.canPlace("copy") || !this._canPaste}
          @click=${this.#onPaste}
        ></jolly-tool-button>
      </div>
    `;
  }

  #renderSelect(): TemplateResult {
    const selectMode = this._selectMode;
    const { shortcuts } = this.attached.state;

    return html`
      <div class="group divided" role="group" aria-label="Select mode">
        ${SELECT_MODES.map((mode) => {
          const { icon, label } = kSelectModeButtons[mode];

          return html`
            <jolly-tool-button
              data-select-mode=${mode}
              icon=${icon}
              label=${shortcuts.label(label, "tool.select")}
              ?active=${selectMode === mode}
              @click=${() => this.#selectMode(mode)}
            ></jolly-tool-button>
          `;
        })}
      </div>
    `;
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
    this.editing?.history.undo();
  }

  #onRedo(): void {
    this.editing?.history.redo();
  }

  #onPaste(): void {
    const editing = this.attached;
    editing.placement.paste(editing.focusPoint());
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
