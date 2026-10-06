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

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  type BrushAxis,
  type BrushStore
} from "../BrushStore.ts";
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import { brushControlsStyles } from "./BrushControls.styles.ts";
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

@customElement("voxel-brush-controls")
export class BrushControls extends WorkspaceElement {
  static override styles = brushControlsStyles;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @state({ hasChanged: availabilityChanged })
  declare _availability: PaintAvailability;

  #size = new FieldBinding<number>(this, {
    read: () => this.#brush.size,
    write: (value) => {
      this.#brush.size = value;
    }
  });

  constructor() {
    super();
    this.disabled = true;
    this._availability = PaintAvailability.Ready;
  }

  get #brush(): BrushStore {
    return this.attached.brush;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { brush } = workspace;
    const refresh = (availability: PaintAvailability): void => {
      this._availability = availability;
      this.disabled = availability.blocked;
    };

    return [
      ...PaintAvailability.watch(workspace, refresh),
      brush.subscribe("change", () => this.requestUpdate()),
      workspace.state.keyboardLayout.subscribe(
        "change",
        () => this.requestUpdate()
      )
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

declare global {
  interface HTMLElementTagNameMap {
    "voxel-brush-controls": BrushControls;
  }
}
