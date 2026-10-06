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
import type { KeyChordString } from "@jolly-pixel/controls";
import { FieldBinding } from "@jolly-pixel/ui";
import type { VoxelHistoryState } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  type BrushAxis,
  type BrushStore
} from "../BrushStore.ts";
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import { brushToolbarStyles } from "./BrushToolbar.styles.ts";
import { PaintAvailability } from "./PaintAvailability.ts";
import {
  BRUSH_AXIS_OPTIONS,
  BRUSH_MODE_OPTIONS,
  BRUSH_PATTERN_OPTIONS,
  ghostLabel,
  toolLabel,
  type BrushToolOption
} from "./brushToolOptions.ts";
import { choiceOf } from "./toolChoice.ts";
import { HISTORY_SHORTCUTS } from "../../../shared/historyShortcuts.ts";
import { BRUSH_SHORTCUTS } from "../interaction/brushShortcuts.ts";
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
export class BrushToolbar extends WorkspaceElement {
  static override styles = brushToolbarStyles;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @state()
  declare _undoDepth: number;

  @state()
  declare _redoDepth: number;

  @state({ hasChanged: availabilityChanged })
  declare _availability: PaintAvailability;

  #size = new FieldBinding<number>(this, {
    read: () => this.#brush.size,
    write: (value) => {
      this.#brush.size = value;
    }
  });

  #onHistoryChange = (
    state: VoxelHistoryState
  ): void => {
    this._undoDepth = state.undoDepth;
    this._redoDepth = state.redoDepth;
  };

  constructor() {
    super();
    this.disabled = true;
    this._undoDepth = 0;
    this._redoDepth = 0;
    this._availability = PaintAvailability.Ready;
  }

  get #brush(): BrushStore {
    return this.attached.brush;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { brush } = workspace;
    const { selection, keyboardLayout } = workspace.state;
    const { history } = workspace.mapDocument;
    const refreshAvailability = (): void => {
      this._availability = PaintAvailability.of(selection, brush.suspended);
      this.disabled = this._availability.blocked;
    };

    this._undoDepth = history.undoDepth;
    this._redoDepth = history.redoDepth;
    refreshAvailability();

    history.on("change", this.#onHistoryChange);

    return [
      brush.subscribe("change", () => this.requestUpdate()),
      keyboardLayout.subscribe("change", () => this.requestUpdate()),
      brush.subscribe("suspendedChange", refreshAvailability),
      selection.subscribe("change", refreshAvailability),
      workspace.mapDocument.subscribe("layerUpdated", refreshAvailability),
      () => history.off("change", this.#onHistoryChange)
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const { brush } = workspace;
    const { keyboardLayout } = workspace.state;
    function shortcut(
      chords: readonly KeyChordString[]
    ): string {
      return keyboardLayout.format(chords[0]);
    }

    const sizeShortcut = [
      shortcut(BRUSH_SHORTCUTS.shrink),
      shortcut(BRUSH_SHORTCUTS.grow)
    ].join(" / ");

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
            icon="undo"
            label=${`Undo (${shortcut(HISTORY_SHORTCUTS.undo)})`}
            ?disabled=${this._undoDepth === 0}
            @click=${this.#onUndo}
          >${renderStepCount(this._undoDepth)}</jolly-tool-button>
          <jolly-tool-button
            data-tool="redo"
            icon="redo"
            label=${`Redo (${shortcut(HISTORY_SHORTCUTS.redo)})`}
            ?disabled=${this._redoDepth === 0}
            @click=${this.#onRedo}
          >${renderStepCount(this._redoDepth)}</jolly-tool-button>
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
            shortcut: shortcut(BRUSH_SHORTCUTS.mode),
            select: (value) => {
              brush.mode = value;
            }
          })}
          ${this.#renderChoice({
            tool: "axis",
            options: BRUSH_AXIS_OPTIONS,
            current: brush.axis,
            shortcut: shortcut(BRUSH_SHORTCUTS.axis),
            select: (value) => {
              brush.axis = value;
            },
            content: axisLetters
          })}
          <jolly-tool-button
            data-tool="size"
            flyout-side="above"
            label=${toolLabel(
              `Size ${this.#size.value}`,
              sizeShortcut,
              this._availability.reason
            )}
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
            shortcut: shortcut(BRUSH_SHORTCUTS.pattern),
            select: (value) => {
              brush.pattern = value;
            }
          })}
          <jolly-tool-button
            data-tool="ghost"
            icon="brush-ghost"
            label=${toolLabel(
              ghostLabel(this.#size.value),
              shortcut(BRUSH_SHORTCUTS.ghost),
              this._availability.reason
            )}
            ?active=${brush.ghost}
            ?disabled=${this.disabled}
            @click=${this.#onGhostToggle}
          ></jolly-tool-button>
        </div>
      </jolly-rail>
    `;
  }

  #renderNotice(): TemplateResult | typeof nothing {
    const { notice } = this._availability;
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
        label=${toolLabel(active.label, shortcut, this._availability.reason)}
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
    this.workspace?.mapDocument.history.undo();
  }

  #onRedo(): void {
    this.workspace?.mapDocument.history.redo();
  }

  #onGhostToggle(): void {
    this.#brush.ghost = !this.#brush.ghost;
  }
}

function availabilityChanged(
  next: PaintAvailability,
  previous: PaintAvailability | undefined
): boolean {
  return previous === undefined || !next.equals(previous);
}

function axisLetters(
  axis: BrushAxis
): TemplateResult {
  const letters = [...axis].map(
    (letter) => html`<span class=${letter}>${letter.toUpperCase()}</span>`
  );

  return html`<span class="axis">${letters}</span>`;
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
    "voxel-brush-toolbar": BrushToolbar;
  }
}
