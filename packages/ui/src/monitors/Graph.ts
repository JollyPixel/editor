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
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { graphStyles } from "./Graph.styles.ts";
import { resolveThemeColor } from "../theme/resolveThemeToken.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

export interface GraphDefaults {
  rows: number;
  samples: number;
}

/**
 * Sparkline over a ring buffer. The application pushes `value`; there is no
 * internal timer. `min`/`max` fix the vertical range; either left `undefined`
 * auto-scales to the buffer's own observed extreme, since a fixed ceiling
 * like a theoretical max framerate is rarely known up front and flattens the
 * line whenever the real values sit far below it.
 */
@customElement("jolly-graph")
export class GraphElement extends LitElement {
  static readonly Defaults: GraphDefaults = {
    rows: 3,
    samples: 60
  };

  static override styles = [
    graphStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare label: string;

  @property({ type: Number })
  declare value: number;

  @property({ type: Number })
  declare min: number | undefined;

  @property({ type: Number })
  declare max: number | undefined;

  @property({ type: Number })
  declare rows: number;

  @property({ type: Number })
  declare samples: number;

  /** Formats the current-value overlay drawn over the graph. */
  @property({ attribute: false })
  declare format: ((value: number) => string) | undefined;

  @query("canvas")
  declare _canvas: HTMLCanvasElement;

  #buffer: number[] = [];
  #resize = new ResizeObserver(
    () => this.#draw()
  );

  constructor() {
    super();

    this.label = "";
    this.value = 0;
    this.min = undefined;
    this.max = undefined;
    this.rows = GraphElement.Defaults.rows;
    this.samples = GraphElement.Defaults.samples;
    this.format = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#buffer = [this.value];
  }

  override disconnectedCallback(): void {
    this.#resize.disconnect();
    super.disconnectedCallback();
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("value")) {
      this.#buffer.push(this.value);
      if (this.#buffer.length > this.samples) {
        this.#buffer.splice(
          0,
          this.#buffer.length - this.samples
        );
      }
    }

    if (changed.has("rows")) {
      this.style.setProperty(
        "--jolly-graph-rows",
        String(this.rows)
      );
    }
  }

  protected override firstUpdated(): void {
    this.#resize.observe(this._canvas);
    this.#draw();
  }

  protected override updated(): void {
    this.#draw();
  }

  override render(): TemplateResult {
    return html`
      <div class="wrap">
        ${this.#renderLabel()}
        <div class="canvas-wrap">
          <canvas></canvas>
          <span class="value">${this.#displayed}</span>
        </div>
      </div>
    `;
  }

  #renderLabel(): TemplateResult | typeof nothing {
    return this.label === "" ?
      nothing :
      html`<span class="label">${this.label}</span>`;
  }

  get #displayed(): string {
    return this.format === undefined ?
      String(Math.round(this.value)) :
      this.format(this.value);
  }

  #draw(): void {
    const canvas = this._canvas;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(
      1,
      Math.round(rect.width * ratio)
    );
    const height = Math.max(
      1,
      Math.round(rect.height * ratio)
    );
    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    if (this.#buffer.length < 2) {
      return;
    }

    const min = this.min ?? Math.min(...this.#buffer);
    const max = this.max ?? Math.max(...this.#buffer);
    const range = max - min || 1;
    ctx.beginPath();
    this.#buffer.forEach((sample, index) => {
      const x = (index / (this.samples - 1)) * width;
      const t = Math.min(1, Math.max(0, (sample - min) / range));
      const y = height - (t * height);

      if (index === 0) {
        ctx.moveTo(x, y);
      }
      else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = resolveThemeColor(
      this,
      "--jolly-accent-fill",
      "#4488ff"
    );
    ctx.lineWidth = Math.max(1, ratio);
    ctx.stroke();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-graph": GraphElement;
  }
}
