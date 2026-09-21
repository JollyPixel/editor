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
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { statsStyles } from "./Stats.styles.ts";
import {
  resolveMetricFormat,
  resolveMetricRange,
  type MetricDefinition
} from "./MetricDefinition.ts";
import type {
  StatsRecorder,
  StatsSnapshot
} from "./StatsRecorder.ts";
import { defaultStorageAdapter } from "../storage/defaultStorage.ts";
import { NamespacedStore } from "../storage/NamespacedStore.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import {
  resolveCssColor,
  resolveThemeColor
} from "../theme/resolveThemeToken.ts";
import {
  resolveMetricPalette,
  type ResolvedMetricPalette,
  type StatsThemeColors
} from "./metricPalette.ts";

// CONSTANTS
const kGraphTop = 18;
const kGraphPadding = 2;

@customElement("jolly-stats")
export class StatsElement extends LitElement {
  static override styles = statsStyles;

  @property({ attribute: false })
  declare recorder: StatsRecorder | null;

  @property({
    type: String,
    attribute: "storage-key"
  })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @query("canvas")
  declare _canvas: HTMLCanvasElement;

  #colors: StatsThemeColors = {
    accent: "#4488ff",
    bed: "#111827",
    success: "#2f8f5b",
    warning: "#ff9d00"
  };
  #palettes = new Map<string, ResolvedMetricPalette>();
  #store = new NamespacedStore({
    namespace: () => this.storageKey,
    storage: () => this.storage
  });
  #selectedId: string | null = null;
  #snapshot: StatsSnapshot = {};
  #unsubscribe: (() => void) | null = null;
  #resize: ResizeObserver | null = null;
  #themeObserver: MutationObserver | null = null;
  #colorScheme: MediaQueryList | null = null;

  constructor() {
    super();

    this.recorder = null;
    this.storageKey = "jolly-stats";
    this.storage = defaultStorageAdapter();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "button");
    }
    if (!this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0");
    }
    this.addEventListener(
      "keydown",
      this.#onKeyDown
    );
    this.#connectRecorder();
    this.#observeTheme();
  }

  override disconnectedCallback(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#resize?.disconnect();
    this.#resize = null;
    this.#themeObserver?.disconnect();
    this.#themeObserver = null;
    this.#colorScheme?.removeEventListener(
      "change",
      this.#refreshTheme
    );
    this.#colorScheme = null;
    this.removeEventListener(
      "keydown",
      this.#onKeyDown
    );
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(
        () => this.#draw()
      );
      this.#resize.observe(this._canvas);
    }
    this.#refreshTheme();
  }

  protected override updated(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("recorder")) {
      this.#connectRecorder();
    }
    if (
      changed.has("storage") ||
      changed.has("storageKey")
    ) {
      this.#restoreSelection();
    }
    this.#syncAccessibleName();
    this.#draw();
  }

  override render(): TemplateResult {
    return html`
      <canvas
        aria-hidden="true"
        @click=${this.#next}
        @contextmenu=${this.#onContextMenu}
      ></canvas>
    `;
  }

  #connectRecorder(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#palettes.clear();
    this.#snapshot = this.recorder?.snapshot() ?? {};
    this.#restoreSelection();
    if (this.recorder !== null) {
      this.#unsubscribe = this.recorder.subscribe((snapshot) => {
        this.#snapshot = snapshot;
        this.#ensureSelection();
        this.requestUpdate();
      });
    }
  }

  #definitions(): readonly MetricDefinition[] {
    return this.recorder?.definitions.filter(
      ({ tile }) => tile !== false
    ) ?? [];
  }

  #restoreSelection(): void {
    const stored = this.#store.read("metric");
    const definitions = this.#definitions();
    this.#selectedId = definitions.some(
      ({ id }) => id === stored
    ) ? stored : (definitions[0]?.id ?? null);
  }

  #ensureSelection(): void {
    const definitions = this.#definitions();
    if (!definitions.some(({ id }) => id === this.#selectedId)) {
      this.#selectedId = definitions[0]?.id ?? null;
    }
  }

  #next = () => {
    this.#cycle(1);
  };

  #previous = () => {
    this.#cycle(-1);
  };

  #onContextMenu = (
    event: MouseEvent
  ) => {
    event.preventDefault();
    this.#previous();
  };

  #cycle(
    delta: number
  ): void {
    const definitions = this.#definitions();
    if (definitions.length === 0) {
      return;
    }

    const selected = definitions.findIndex(
      ({ id }) => id === this.#selectedId
    );
    const index = selected < 0 ? 0 : selected;
    const next = (
      index + delta + definitions.length
    ) % definitions.length;
    this.#selectedId = definitions[next].id;
    this.#store.write("metric", this.#selectedId);
    this.requestUpdate();
  }

  #onKeyDown = (
    event: KeyboardEvent
  ) => {
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      this.#next();
    }
    else if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      event.preventDefault();
      this.#previous();
    }
  };

  #selectedDefinition(): MetricDefinition | null {
    return this.#definitions().find(
      ({ id }) => id === this.#selectedId
    ) ?? null;
  }

  #syncAccessibleName(): void {
    const definition = this.#selectedDefinition();
    if (definition === null) {
      this.setAttribute(
        "aria-label",
        "Performance statistics unavailable"
      );

      return;
    }

    const value = this.#format(
      definition,
      this.#snapshot[definition.id] ?? 0
    );
    this.setAttribute(
      "aria-label",
      `${definition.label}: ${value}. Activate to show the next metric.`
    );
  }

  #observeTheme(): void {
    this.#themeObserver?.disconnect();
    const target = this.closest("jolly-scope") ?? this;
    if (typeof MutationObserver !== "undefined") {
      this.#themeObserver = new MutationObserver(
        this.#refreshTheme
      );
      this.#themeObserver.observe(target, {
        attributes: true,
        attributeFilter: ["theme"]
      });
    }

    const view = this.ownerDocument.defaultView;
    this.#colorScheme = view?.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ) ?? null;
    this.#colorScheme?.addEventListener(
      "change",
      this.#refreshTheme
    );
    this.#refreshTheme();
  }

  #refreshTheme = () => {
    this.#colors = {
      accent: resolveThemeColor(
        this,
        "--jolly-accent-text",
        "#4488ff"
      ),
      bed: resolveThemeColor(
        this,
        "--jolly-surface-sunken",
        "#111827"
      ),
      success: resolveThemeColor(
        this,
        "--jolly-success",
        "#2f8f5b"
      ),
      warning: resolveThemeColor(
        this,
        "--jolly-warning",
        "#ff9d00"
      )
    };
    this.#palettes.clear();
    this.#draw();
  };

  #draw(): void {
    const canvas = this._canvas;
    if (canvas === undefined || canvas === null) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = this.ownerDocument.defaultView?.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }
    context.clearRect(0, 0, width, height);

    const definition = this.#selectedDefinition();
    if (
      definition === null ||
      this.recorder === null
    ) {
      return;
    }

    context.save();
    context.scale(ratio, ratio);
    const palette = this.#palette(definition);
    context.fillStyle = palette.bed;
    context.fillRect(0, 0, rect.width, rect.height);
    this.#drawReadout(
      context,
      definition,
      palette,
      rect.width
    );
    this.#drawGraph(
      context,
      definition,
      palette,
      rect.width,
      rect.height
    );
    context.restore();
  }

  #drawReadout(
    context: CanvasRenderingContext2D,
    definition: MetricDefinition,
    palette: ResolvedMetricPalette,
    width: number
  ): void {
    const value = this.#snapshot[definition.id] ?? 0;
    const valueText = this.#format(definition, value);
    context.font = "bold 11px Helvetica, Arial, sans-serif";
    context.textBaseline = "top";
    context.fillStyle = palette.ink;
    context.textAlign = "right";
    context.fillText(
      valueText,
      width - kGraphPadding,
      kGraphPadding
    );

    const labelWidth = width -
      context.measureText(valueText).width -
      (kGraphPadding * 3);
    context.textAlign = "left";
    context.fillText(
      fitText(context, definition.label, labelWidth),
      kGraphPadding,
      kGraphPadding
    );
  }

  #drawGraph(
    context: CanvasRenderingContext2D,
    definition: MetricDefinition,
    palette: ResolvedMetricPalette,
    width: number,
    height: number
  ): void {
    const history = this.recorder?.history(definition.id) ?? [];
    if (history.length === 0) {
      return;
    }

    const bounds = resolveMetricRange(definition, history);
    const range = bounds.max - bounds.min || 1;
    const graphHeight = height - kGraphTop - kGraphPadding;
    const ratio = context.getTransform().a || 1;
    const graphLeftPixels = Math.round(kGraphPadding * ratio);
    const graphWidthPixels = Math.max(
      1,
      Math.round((width - (kGraphPadding * 2)) * ratio)
    );
    const graphLeft = graphLeftPixels / ratio;
    const graphWidth = graphWidthPixels / ratio;
    context.fillStyle = palette.ink;
    context.fillRect(
      graphLeft,
      kGraphTop,
      graphWidth,
      graphHeight
    );
    context.fillStyle = palette.bed;

    history.forEach((sample, index) => {
      const normalized = Math.min(
        1,
        Math.max(0, (sample - bounds.min) / range)
      );
      const barHeight = Math.max(1, normalized * graphHeight);
      const coverHeight = graphHeight - barHeight;
      const barLeftPixels = graphLeftPixels + Math.floor(
        (index * graphWidthPixels) / history.length
      );
      const barRightPixels = graphLeftPixels + Math.floor(
        ((index + 1) * graphWidthPixels) / history.length
      );
      context.fillRect(
        barLeftPixels / ratio,
        kGraphTop,
        (barRightPixels - barLeftPixels) / ratio,
        coverHeight
      );
    });
  }

  #palette(
    definition: MetricDefinition
  ): ResolvedMetricPalette {
    let palette = this.#palettes.get(definition.id);
    if (palette === undefined) {
      palette = resolveMetricPalette(
        definition,
        this.#colors,
        (value, fallback) => resolveCssColor(this, value, fallback)
      );
      this.#palettes.set(definition.id, palette);
    }

    return palette;
  }

  #format(
    definition: MetricDefinition,
    value: number
  ): string {
    return resolveMetricFormat(definition)(value);
  }
}

function fitText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
): string {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let shortened = value;
  while (
    shortened.length > 1 &&
    context.measureText(`${shortened}…`).width > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }

  return `${shortened}…`;
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-stats": StatsElement;
  }
}
