// Import Third-party Dependencies
import {
  LitElement,
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
import { FieldBinding } from "@jolly-pixel/ui";
import type { VoxelHistoryState } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  type BrushMode
} from "../../../state/index.ts";
import type { VoxelMapWorkspace } from "../../../scene/EditorScene.ts";
import { WorkspaceController } from "../../../shared/WorkspaceController.ts";
import type {
  BrushAxis,
  BrushPattern
} from "../model/brushFootprint.ts";
import { brushToolbarStyles } from "./BrushToolbar.styles.ts";
import {
  BRUSH_AXIS_OPTIONS,
  BRUSH_MODE_OPTIONS,
  BRUSH_PATTERN_OPTIONS,
  choiceOf,
  ghostLabel,
  toolLabel,
  type BrushToolOption
} from "./brushToolOptions.ts";
import "./brushIcons.ts";

interface ChoiceTool<TValue extends string> {
  tool: string;
  options: readonly BrushToolOption<TValue>[];
  current: TValue;
  shortcut: string;
  select: (value: TValue) => void;
  content?: (value: TValue) => TemplateResult | typeof nothing;
}

@customElement("voxel-brush-toolbar")
export class BrushToolbar extends LitElement {
  static override styles = brushToolbarStyles;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @state()
  declare _mode: BrushMode;

  @state()
  declare _axis: BrushAxis;

  @state()
  declare _pattern: BrushPattern;

  @state()
  declare _ghost: boolean;

  @state()
  declare _canUndo: boolean;

  @state()
  declare _canRedo: boolean;

  #size = new FieldBinding<number>(this, {
    read: () => this.#workspace.attached.state.brush.size,
    write: (value) => {
      this.#workspace.attached.state.brush.size = value;
    }
  });

  #onHistoryChange = (
    state: VoxelHistoryState
  ): void => {
    this._canUndo = state.canUndo;
    this._canRedo = state.canRedo;
  };

  #workspace = new WorkspaceController(this, (workspace) => {
    const { brush, selection } = workspace.state;
    const { history } = workspace.engine;

    this._mode = brush.mode;
    this._axis = brush.axis;
    this._pattern = brush.pattern;
    this._ghost = brush.ghost;
    this._canUndo = history.canUndo;
    this._canRedo = history.canRedo;
    this.disabled = selection.voxelLayer === null;

    history.on("change", this.#onHistoryChange);

    return [
      brush.subscribe("modeChange", (mode) => {
        this._mode = mode;
      }),
      brush.subscribe("axisChange", (axis) => {
        this._axis = axis;
      }),
      brush.subscribe("patternChange", (pattern) => {
        this._pattern = pattern;
      }),
      brush.subscribe("sizeChange", () => {
        this.requestUpdate();
      }),
      brush.subscribe("ghostChange", (ghost) => {
        this._ghost = ghost;
      }),
      selection.subscribe("change", () => {
        this.disabled = selection.voxelLayer === null;
      }),
      () => history.off("change", this.#onHistoryChange)
    ];
  });

  constructor() {
    super();
    this.disabled = true;
  }

  attach(
    workspace: VoxelMapWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  override render(): TemplateResult | typeof nothing {
    if (this.#workspace.current === null) {
      return nothing;
    }

    return html`
      <jolly-rail
        orientation="horizontal"
        role="toolbar"
        aria-label="Map editing"
      >
        <div class="group" role="group" aria-label="History">
          <jolly-tool-button
            data-tool="undo"
            icon="history-undo"
            label="Undo (Ctrl+Z)"
            ?disabled=${!this._canUndo}
            @click=${this.#onUndo}
          ></jolly-tool-button>
          <jolly-tool-button
            data-tool="redo"
            icon="history-redo"
            label="Redo (Ctrl+Y)"
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
            current: this._mode,
            shortcut: "R",
            select: (value) => {
              this.#workspace.attached.state.brush.mode = value;
            }
          })}
          ${this.#renderChoice({
            tool: "axis",
            options: BRUSH_AXIS_OPTIONS,
            current: this._axis,
            shortcut: "X",
            select: (value) => {
              this.#workspace.attached.state.brush.axis = value;
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
            current: this._pattern,
            shortcut: "C",
            select: (value) => {
              this.#workspace.attached.state.brush.pattern = value;
            }
          })}
          <jolly-tool-button
            data-tool="ghost"
            icon="brush-ghost"
            label=${toolLabel(ghostLabel(this.#size.value), "G", this.disabled)}
            ?active=${this._ghost}
            ?disabled=${this.disabled}
            @click=${this.#onGhostToggle}
          ></jolly-tool-button>
        </div>
      </jolly-rail>
    `;
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
    this.#workspace.current?.engine.history.undo();
  }

  #onRedo(): void {
    this.#workspace.current?.engine.history.redo();
  }

  #onGhostToggle(): void {
    this.#workspace.attached.state.brush.ghost = !this.#workspace.attached.state.brush.ghost;
  }
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
