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
import { ifDefined } from "lit/directives/if-defined.js";
import { KeyChord } from "@jolly-pixel/controls";
import { FieldBinding } from "@jolly-pixel/ui";
import type { VoxelHistoryState } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  type BrushAxis,
  type BrushStore
} from "../../../state/index.ts";
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import { brushToolbarStyles } from "./BrushToolbar.styles.ts";
import {
  paintingNoticeOf,
  type PaintingNotice
} from "./paintingNotice.ts";
import {
  BRUSH_AXIS_OPTIONS,
  BRUSH_MODE_OPTIONS,
  BRUSH_PATTERN_OPTIONS,
  choiceOf,
  ghostLabel,
  toolLabel,
  type BrushToolOption
} from "./brushToolOptions.ts";
import { HISTORY_SHORTCUTS } from "../../../scene/historyShortcuts.ts";
import "./brushIcons.ts";

// CONSTANTS
const kUndoLabel = `Undo (${KeyChord.parse(HISTORY_SHORTCUTS.undo[0]).format()})`;
const kRedoLabel = `Redo (${KeyChord.parse(HISTORY_SHORTCUTS.redo[0]).format()})`;

interface ChoiceTool<TValue extends string> {
  tool: string;
  options: readonly BrushToolOption<TValue>[];
  current: TValue;
  shortcut: string;
  select: (value: TValue) => void;
  content?: (value: TValue) => TemplateResult | typeof nothing;
}

@customElement("voxel-brush-toolbar")
export class BrushToolbar extends WorkspaceElement {
  static override styles = brushToolbarStyles;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @state()
  declare _canUndo: boolean;

  @state()
  declare _canRedo: boolean;

  @state({ hasChanged: noticeChanged })
  declare _notice: PaintingNotice | null;

  #size = new FieldBinding<number>(this, {
    read: () => this.#brush.size,
    write: (value) => {
      this.#brush.size = value;
    }
  });

  #onHistoryChange = (
    state: VoxelHistoryState
  ): void => {
    this._canUndo = state.canUndo;
    this._canRedo = state.canRedo;
  };

  constructor() {
    super();
    this.disabled = true;
    this._notice = null;
  }

  get #brush(): BrushStore {
    return this.attached.state.brush;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { brush, selection } = workspace.state;
    const { history } = workspace.view.document;
    const refreshSelection = (): void => {
      this.disabled = selection.voxelLayer === null;
      this._notice = paintingNoticeOf(selection);
    };

    this._canUndo = history.canUndo;
    this._canRedo = history.canRedo;
    refreshSelection();

    history.on("change", this.#onHistoryChange);

    return [
      brush.subscribe("change", () => this.requestUpdate()),
      selection.subscribe("change", refreshSelection),
      workspace.mapDocument.subscribe("layerUpdated", refreshSelection),
      () => history.off("change", this.#onHistoryChange)
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const { brush } = workspace.state;

    return html`
      ${this.#renderNotice()}
      <jolly-rail
        orientation="horizontal"
        role="toolbar"
        aria-label="Map editing"
      >
        <div class="group" role="group" aria-label="History">
          <jolly-tool-button
            data-tool="undo"
            icon="history-undo"
            label=${kUndoLabel}
            ?disabled=${!this._canUndo}
            @click=${this.#onUndo}
          ></jolly-tool-button>
          <jolly-tool-button
            data-tool="redo"
            icon="history-redo"
            label=${kRedoLabel}
            ?disabled=${!this._canRedo}
            @click=${this.#onRedo}
          ></jolly-tool-button>
        </div>
        <span class="separator" aria-hidden="true"></span>
        <div
          class="group brush"
          role="group"
          aria-label="Brush"
          aria-disabled=${String(this.disabled)}
        >
          ${this.#renderChoice({
            tool: "mode",
            options: BRUSH_MODE_OPTIONS,
            current: brush.mode,
            shortcut: "R",
            select: (value) => {
              brush.mode = value;
            }
          })}
          ${this.#renderChoice({
            tool: "axis",
            options: BRUSH_AXIS_OPTIONS,
            current: brush.axis,
            shortcut: "X",
            select: (value) => {
              brush.axis = value;
            },
            content: axisLetters
          })}
          <jolly-tool-button
            data-tool="size"
            flyout-side="above"
            label=${toolLabel(`Size ${this.#size.value}`, "[ / ]", this.disabled)}
            ?disabled=${this.disabled}
          >
            <span class="size">${this.#size.value}</span>
            <jolly-slider
              slot="flyout"
              orientation="vertical"
              min=${BRUSH_MIN_SIZE}
              max=${BRUSH_MAX_SIZE}
              step="1"
              .value=${this.#size.value}
              @jolly-input=${this.#size.input}
              @jolly-change=${this.#size.commit}
            ></jolly-slider>
          </jolly-tool-button>
          ${this.#renderChoice({
            tool: "pattern",
            options: BRUSH_PATTERN_OPTIONS,
            current: brush.pattern,
            shortcut: "C",
            select: (value) => {
              brush.pattern = value;
            }
          })}
          <jolly-tool-button
            data-tool="ghost"
            icon="brush-ghost"
            label=${toolLabel(ghostLabel(this.#size.value), "G", this.disabled)}
            ?active=${brush.ghost}
            ?disabled=${this.disabled}
            @click=${this.#onGhostToggle}
          ></jolly-tool-button>
        </div>
      </jolly-rail>
    `;
  }

  #renderNotice(): TemplateResult | typeof nothing {
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
    this.workspace?.state.selection.selectVoxelLayer(layerName);
  }

  #renderChoice<TValue extends string>(
    choice: ChoiceTool<TValue>
  ): TemplateResult {
    const {
      tool,
      options,
      current,
      shortcut,
      select,
      content = () => nothing
    } = choice;
    const { active, alternatives } = choiceOf(options, current);

    return html`
      <jolly-tool-button
        data-tool=${tool}
        data-value=${active.value}
        flyout-side="above"
        icon=${ifDefined(active.icon)}
        label=${toolLabel(active.label, shortcut, this.disabled)}
        ?disabled=${this.disabled}
      >
        ${content(active.value)}
        ${alternatives.map((option) => html`
          <jolly-tool-button
            slot="flyout"
            data-value=${option.value}
            flyout-side="left"
            icon=${ifDefined(option.icon)}
            label=${option.label}
            @click=${() => select(option.value)}
          >${content(option.value)}</jolly-tool-button>
        `)}
      </jolly-tool-button>
    `;
  }

  #onUndo(): void {
    this.workspace?.view.document.history.undo();
  }

  #onRedo(): void {
    this.workspace?.view.document.history.redo();
  }

  #onGhostToggle(): void {
    this.#brush.ghost = !this.#brush.ghost;
  }
}

function noticeChanged(
  next: PaintingNotice | null,
  previous: PaintingNotice | null
): boolean {
  return next?.message !== previous?.message ||
    next?.resumeLayer !== previous?.resumeLayer;
}

function axisLetters(
  axis: BrushAxis
): TemplateResult {
  const letters = [...axis].map(
    (letter) => html`<span class=${letter}>${letter.toUpperCase()}</span>`
  );

  return html`<span class="axis">${letters}</span>`;
}

declare global {
  interface HTMLElementTagNameMap {
    "voxel-brush-toolbar": BrushToolbar;
  }
}
