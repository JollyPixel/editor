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
import { FieldBinding } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  type BrushStore
} from "../../../state/index.ts";
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import type { MapAction } from "../../../keybindings/MapKeyBindings.ts";
import { brushControlsStyles } from "./BrushControls.styles.ts";
import { PaintAvailability } from "./PaintAvailability.ts";
import {
  BRUSH_MODE_OPTIONS,
  BRUSH_PATTERN_OPTIONS,
  ghostLabel,
  type BrushToolOption
} from "./brushToolOptions.ts";
import { resolveToolChoice } from "./toolChoice.ts";
import "./brushIcons.ts";

interface ChoiceTool<TValue extends string> {
  tool: string;
  options: readonly BrushToolOption<TValue>[];
  current: TValue;
  action: MapAction;
  select: (value: TValue) => void;
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
    return this.attached.state.brush;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { brush } = workspace.state;
    const refresh = (availability: PaintAvailability): void => {
      this._availability = availability;
      this.disabled = availability.blocked;
    };

    return [
      ...PaintAvailability.watch(workspace, refresh),
      brush.subscribe("change", () => this.requestUpdate()),
      workspace.state.shortcuts.subscribe(() => this.requestUpdate())
    ];
  }

  override render(): TemplateResult | typeof nothing {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const { brush } = workspace.state;

    return html`
      <div
        class="group divided brush"
        role="group"
        aria-label="Brush"
        aria-disabled=${String(this.disabled)}
      >
        ${this.#renderChoice({
          tool: "mode",
          options: BRUSH_MODE_OPTIONS,
          current: brush.mode,
          action: "brush.mode",
          select: (value) => {
            brush.mode = value;
          }
        })}
        <jolly-tool-button
          data-tool="size"
          flyout-side="above"
          label=${this.#label(
            `Size ${this.#size.value}`,
            "brush.shrink",
            "brush.grow"
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
          action: "brush.pattern",
          select: (value) => {
            brush.pattern = value;
          }
        })}
        <jolly-tool-button
          data-tool="ghost"
          icon="brush-ghost"
          label=${this.#label(ghostLabel(this.#size.value), "brush.ghost")}
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
      action,
      select
    } = choice;
    const { active, alternatives } = resolveToolChoice(options, current);

    return html`
      <jolly-tool-button
        data-tool=${tool}
        data-value=${active.value}
        flyout-side="above"
        icon=${ifDefined(active.icon)}
        label=${this.#label(active.label, action)}
        ?disabled=${this.disabled}
      >
        ${alternatives.map((option) => html`
          <jolly-tool-button
            slot="flyout"
            data-value=${option.value}
            flyout-side="left"
            icon=${ifDefined(option.icon)}
            label=${option.label}
            @click=${() => select(option.value)}
          ></jolly-tool-button>
        `)}
      </jolly-tool-button>
    `;
  }

  #label(
    text: string,
    ...actions: MapAction[]
  ): string {
    return this._availability.reason ??
      this.attached.state.shortcuts.label(text, ...actions);
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

declare global {
  interface HTMLElementTagNameMap {
    "voxel-brush-controls": BrushControls;
  }
}
