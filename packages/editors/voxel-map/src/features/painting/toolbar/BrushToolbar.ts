// Import Third-party Dependencies
import {
  LitElement,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import type {
  VoxelHistory,
  VoxelHistoryState
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
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
  toolLabel,
  type BrushToolOption
} from "./brushToolOptions.ts";
import "./brushIcons.ts";

// CONSTANTS
const kMinSize = 1;
const kMaxSize = 8;

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
          ${this.#renderChoice(
            "mode",
            BRUSH_MODE_OPTIONS,
            this._mode,
            "R",
            (value) => {
              this.brush.mode = value;
            }
          )}
          ${this.#renderChoice(
            "axis",
            BRUSH_AXIS_OPTIONS,
            this._axis,
            "X",
            (value) => {
              this.brush.axis = value;
            }
          )}
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
              min=${kMinSize}
              max=${kMaxSize}
              step="1"
              .value=${this._size}
              @jolly-input=${this.#onSizeInput}
              @jolly-change=${this.#onSizeInput}
            ></jolly-slider>
          </jolly-tool-button>
          ${this.#renderChoice(
            "pattern",
            BRUSH_PATTERN_OPTIONS,
            this._pattern,
            "C",
            (value) => {
              this.brush.pattern = value;
            }
          )}
        </div>
      </jolly-rail>
    `;
  }

  #renderChoice<TValue extends string>(
    tool: string,
    options: readonly BrushToolOption<TValue>[],
    current: TValue,
    shortcut: string,
    select: (value: TValue) => void
  ): TemplateResult {
    const { active, alternatives } = choiceOf(options, current);

    return html`
      <jolly-tool-button
        data-tool=${tool}
        data-value=${active.value}
        flyout-side="above"
        icon=${active.icon}
        label=${toolLabel(active.label, shortcut, this.disabled)}
        ?disabled=${this.disabled}
      >
        ${alternatives.map((option) => html`
          <jolly-tool-button
            slot="flyout"
            data-value=${option.value}
            flyout-side="left"
            icon=${option.icon}
            label=${option.label}
            @click=${() => select(option.value)}
          ></jolly-tool-button>
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
    this._canUndo = this.history?.canUndo ?? false;
    this._canRedo = this.history?.canRedo ?? false;
    this.disabled = this.selection.voxelLayer === null;
  }

  #subscribe(): void {
    this.#unsubscribe();
    this.#read();

    const { brush, selection, history } = this;
    this.#subscriptions = [
      brush.watch("modeChange", (mode) => {
        this._mode = mode;
      }),
      brush.watch("axisChange", (axis) => {
        this._axis = axis;
      }),
      brush.watch("patternChange", (pattern) => {
        this._pattern = pattern;
      }),
      brush.watch("sizeChange", (size) => {
        this._size = size;
      }),
      selection.watch("change", () => {
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

declare global {
  interface HTMLElementTagNameMap {
    "voxel-brush-toolbar": BrushToolbar;
  }
}
