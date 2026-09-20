// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import type {
  VoxelHistory,
  VoxelHistoryState
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  editorState,
  type BrushMode,
  type BrushStore,
  type SelectionStore
} from "../../../app/state/index.ts";
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

  @property({ attribute: false })
  declare brush: BrushStore;

  @property({ attribute: false })
  declare selection: SelectionStore;

  @property({ attribute: false })
  declare history: VoxelHistory | null;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @state()
  declare _mode: BrushMode;

  @state()
  declare _axis: BrushAxis;

  @state()
  declare _pattern: BrushPattern;

  @state()
  declare _size: number;

  @state()
  declare _ghost: boolean;

  @state()
  declare _canUndo: boolean;

  @state()
  declare _canRedo: boolean;

  #subscriptions: Array<() => void> = [];

  #onHistoryChange = (
    state: VoxelHistoryState
  ): void => {
    this._canUndo = state.canUndo;
    this._canRedo = state.canRedo;
  };

  constructor() {
    super();

    this.brush = editorState.brush;
    this.selection = editorState.selection;
    this.history = null;
    this.disabled = true;
    this.#read();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#subscribe();
  }

  override disconnectedCallback(): void {
    this.#unsubscribe();
    super.disconnectedCallback();
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (
      this.isConnected &&
      (
        changed.has("brush") ||
        changed.has("selection") ||
        changed.has("history")
      )
    ) {
      this.#subscribe();
    }
  }

  override render(): TemplateResult {
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
              this.brush.mode = value;
            }
          })}
          ${this.#renderChoice({
            tool: "axis",
            options: BRUSH_AXIS_OPTIONS,
            current: this._axis,
            shortcut: "X",
            select: (value) => {
              this.brush.axis = value;
            },
            content: axisLetters
          })}
          <jolly-tool-button
            data-tool="size"
            flyout-side="above"
            label=${toolLabel(`Size ${this._size}`, "[ / ]", this.disabled)}
            ?disabled=${this.disabled}
          >
            <span class="size">${this._size}</span>
            <jolly-slider
              slot="flyout"
              orientation="vertical"
              min=${BRUSH_MIN_SIZE}
              max=${BRUSH_MAX_SIZE}
              step="1"
              .value=${this._size}
              @jolly-input=${this.#onSizeInput}
              @jolly-change=${this.#onSizeInput}
            ></jolly-slider>
          </jolly-tool-button>
          ${this.#renderChoice({
            tool: "pattern",
            options: BRUSH_PATTERN_OPTIONS,
            current: this._pattern,
            shortcut: "C",
            select: (value) => {
              this.brush.pattern = value;
            }
          })}
          <jolly-tool-button
            data-tool="ghost"
            icon="brush-ghost"
            label=${toolLabel(ghostLabel(this._size), "G", this.disabled)}
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
    this.history?.undo();
  }

  #onRedo(): void {
    this.history?.redo();
  }

  #onGhostToggle(): void {
    this.brush.ghost = !this.brush.ghost;
  }

  #onSizeInput(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    this.brush.size = event.detail.value;
    this._size = this.brush.size;
  }

  #read(): void {
    this._mode = this.brush.mode;
    this._axis = this.brush.axis;
    this._pattern = this.brush.pattern;
    this._size = this.brush.size;
    this._ghost = this.brush.ghost;
    this._canUndo = this.history?.canUndo ?? false;
    this._canRedo = this.history?.canRedo ?? false;
    this.disabled = this.selection.voxelLayer === null;
  }

  #subscribe(): void {
    this.#unsubscribe();
    this.#read();

    const { brush, selection, history } = this;
    this.#subscriptions = [
      brush.subscribe("modeChange", (mode) => {
        this._mode = mode;
      }),
      brush.subscribe("axisChange", (axis) => {
        this._axis = axis;
      }),
      brush.subscribe("patternChange", (pattern) => {
        this._pattern = pattern;
      }),
      brush.subscribe("sizeChange", (size) => {
        this._size = size;
      }),
      brush.subscribe("ghostChange", (ghost) => {
        this._ghost = ghost;
      }),
      selection.subscribe("change", () => {
        this.disabled = selection.voxelLayer === null;
      })
    ];

    if (history !== null) {
      history.on("change", this.#onHistoryChange);
      this.#subscriptions.push(
        () => history.off("change", this.#onHistoryChange)
      );
    }
  }

  #unsubscribe(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
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
