// Import Third-party Dependencies
import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { layerGridStyles } from "./LayerGrid.styles.ts";
import {
  LayerGridLayout,
  type LayerGridDirection
} from "./LayerGridLayout.ts";
import {
  layerGridSemantics,
  type LayerGridBrush
} from "./LayerGridSemantics.ts";
import {
  startPointerDragSession,
  type PointerDragResult
} from "../interaction/pointer/PointerDragSession.ts";
import { RovingFocus } from "../interaction/focus/RovingFocus.ts";

export type LayerGridMode = "mask" | "index";

export interface LayerGridDefaults {
  value: number;
  count: number;
  columns: number;
  mode: LayerGridMode;
  start: number;
}

interface LayerGridStroke {
  readonly brush: LayerGridBrush;
  value: number;
  last: number;
}

// CONSTANTS
const kDirections: Record<string, LayerGridDirection> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "first",
  End: "last"
};

@customElement("jolly-layer-grid")
export class LayerGrid extends JollyField<number> {
  static readonly MaxCount = LayerGridLayout.MaxCount;

  static readonly Defaults: LayerGridDefaults = {
    value: 0,
    count: 20,
    columns: 5,
    mode: "mask",
    start: 1
  };

  static override styles = [
    ...JollyField.styles,
    layerGridStyles
  ];

  @property({ type: Number })
  declare count: number;

  @property({ type: Number })
  declare columns: number;

  @property({ type: String, reflect: true })
  declare mode: LayerGridMode;

  @property({ type: Number })
  declare start: number;

  @property({ attribute: false })
  declare names: Readonly<Record<number, string>>;

  #roving = new RovingFocus(this, ".cell");
  #layout = new LayerGridLayout(
    LayerGrid.Defaults.count,
    LayerGrid.Defaults.columns
  );
  #semantics = layerGridSemantics(LayerGrid.Defaults.mode);
  #stroke: LayerGridStroke | null = null;

  constructor() {
    super();

    this.value = LayerGrid.Defaults.value;
    this.count = LayerGrid.Defaults.count;
    this.columns = LayerGrid.Defaults.columns;
    this.mode = LayerGrid.Defaults.mode;
    this.start = LayerGrid.Defaults.start;
    this.names = {};
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    super.willUpdate(changed);
    if (changed.has("count") || changed.has("columns")) {
      this.#layout = new LayerGridLayout(
        this.count,
        this.columns > 0 ? this.columns : LayerGrid.Defaults.columns
      );
    }
    if (changed.has("mode")) {
      this.#semantics = layerGridSemantics(this.mode);
    }
  }

  protected renderValue(): TemplateResult {
    const shown = this.#stroke?.value ?? this.concreteValue;
    const tabStop = this.#tabStop(shown);

    return html`
      <div
        class="grid"
        role=${this.#semantics.groupRole}
        aria-label=${this.label || this.getAttribute("aria-label") || nothing}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.disabled ? "true" : this.lockedAria}
        aria-description=${this.lockDescription}
        style="--jolly-layer-grid-columns: ${this.#layout.columns}"
        @pointerdown=${this.#onPointerDown}
        @keydown=${this.#onKeyDown}
        @focusin=${this.#onFocusIn}
      >
        ${this.#layout.blocks().map((block) => html`
          <div class="block">
            ${block.map((index) => this.#renderCell(index, shown, tabStop))}
          </div>
        `)}
      </div>
    `;
  }

  #renderCell(
    index: number,
    shown: number | undefined,
    tabStop: number
  ): TemplateResult {
    const number = index + this.start;
    const name = this.names[index];
    const title = name === undefined ? nothing : `${number}: ${name}`;

    return html`
      <span
        class="cell"
        role=${this.#semantics.cellRole}
        data-index=${index}
        aria-checked=${this.#semantics.checked(shown, index)}
        aria-label=${title}
        title=${title}
        tabindex=${!this.disabled && index === tabStop ? 0 : -1}
      >${number}</span>
    `;
  }

  #tabStop(
    shown: number | undefined
  ): number {
    const selected = this.#semantics.selected(shown);
    if (selected !== null && this.#layout.contains(selected)) {
      return selected;
    }

    const focused = this.#roving.focused;

    return this.#layout.contains(focused) ? focused : 0;
  }

  #onFocusIn(
    event: FocusEvent
  ): void {
    this.#roving.track(event);
  }

  #onPointerDown(
    event: PointerEvent
  ): void {
    const index = this.#roving.indexAt(event.target);
    if (
      event.button !== 0 ||
      index === null ||
      !this.editable ||
      this.#stroke !== null
    ) {
      return;
    }

    const origin = this.concreteValue;
    const stroke = this.#press(index);
    this.#stroke = stroke;
    this.emitInput(stroke.value);
    this.requestUpdate();

    startPointerDragSession({
      element: this,
      event,
      onMove: (clientX, clientY) => this.#paintAt(stroke, clientX, clientY),
      onFinish: (result) => this.#finishStroke(stroke, result, origin)
    });
  }

  #paintAt(
    stroke: LayerGridStroke,
    clientX: number,
    clientY: number
  ): void {
    const index = this.#roving.indexAt(
      this.shadowRoot?.elementFromPoint(clientX, clientY) ?? null
    );
    if (index === null || index === stroke.last) {
      return;
    }

    stroke.last = index;
    stroke.value = stroke.brush(stroke.value, index);
    this.emitInput(stroke.value);
    this.requestUpdate();
  }

  #finishStroke(
    stroke: LayerGridStroke,
    result: PointerDragResult,
    origin: number | undefined
  ): void {
    this.#stroke = null;
    this.requestUpdate();
    if (result === "commit") {
      this.#roving.focus(stroke.last);
      this.emitChange(stroke.value);
    }
    else if (origin !== undefined) {
      this.emitInput(origin);
    }
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    const index = this.#roving.indexAt(event.target);
    if (index === null || this.#stroke !== null) {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      this.#activate(index);

      return;
    }

    const direction = kDirections[event.key];
    if (direction === undefined) {
      return;
    }

    event.preventDefault();
    const next = this.#layout.moveFrom(index, direction);
    this.#roving.focus(next);
    if (this.#semantics.selectionFollowsFocus && next !== index) {
      this.#activate(next);
    }
  }

  #activate(
    index: number
  ): void {
    if (this.editable) {
      this.emitChange(this.#press(index).value);
    }
  }

  #press(
    index: number
  ): LayerGridStroke {
    const origin = this.concreteValue;
    const brush = this.#semantics.brush(origin, index);

    return {
      brush,
      value: brush(origin ?? 0, index),
      last: index
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-layer-grid": LayerGrid;
  }
}
