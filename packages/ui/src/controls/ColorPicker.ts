// Import Third-party Dependencies
import {
  colorHarmony,
  formatHex,
  type HSVA
} from "@jolly-pixel/color";
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
import { saturationValueFromPointer } from "../color/area.ts";
import {
  channelValues,
  CHANNEL_ROWS,
  type ColorPickerChannels
} from "../color/channels.ts";
import { parseFieldColor } from "../color/draft.ts";
import { PickerFields } from "../color/PickerFields.ts";
import { PickerPreferences } from "../color/PickerPreferences.ts";
import { PickerSettings } from "../color/PickerSettings.ts";
import {
  COLOR_PICKER_DEFAULTS,
  type ColorPickerHarmony,
  type ColorPickerPreferences,
  type ColorPickerPreferenceSource,
  type ColorPickerSelector
} from "../color/preferences.ts";
import {
  PickerSpace,
  type ColorPickerSpace
} from "../color/space.ts";
import {
  paintSurface,
  SquareSurface,
  WheelSurface,
  type PickerSurface
} from "../color/surface.ts";
import {
  DISCRETE_HUE_STEP,
  DISCRETE_SATURATION_STEPS,
  hueSaturationFromPointer,
  snapToWheel,
  wheelPosition
} from "../color/wheel.ts";
import { colorPickerStyles } from "./ColorPicker.styles.ts";
import { emitComposedEvent } from "../events.ts";
import {
  emitFieldEvent,
  type JollyChangeDetail
} from "../field/events.ts";
import { isInputElement } from "../dom.ts";

// CONSTANTS
const kAxisSteps = 1000;
const kHueSteps = 360;
const kAlphaSteps = 100;
const kBlack: HSVA = {
  h: 0,
  s: 0,
  v: 0,
  a: 1
};
const kPreferences = new PickerPreferences();

export type ColorPickerLayout = "stack" | "wide";
export type {
  ColorPickerChannels,
  ColorPickerHarmony,
  ColorPickerPreferences,
  ColorPickerPreferenceSource,
  ColorPickerSelector,
  ColorPickerSpace
};

export interface ColorPickerDefaults {
  value: string;
  layout: ColorPickerLayout;
}

interface SliderTemplate {
  label: string;
  max: number;
  value: number;
  onChange: (event: Event) => void;
  className?: string;
  step?: number;
  vertical?: boolean;
}

@customElement("jolly-color-picker")
export class ColorPicker extends LitElement {
  static readonly Defaults: ColorPickerDefaults = {
    value: "#000000",
    layout: "stack"
  };

  static override styles = [
    colorPickerStyles
  ];

  static configure(
    patch: Partial<ColorPickerPreferences>
  ): void {
    kPreferences.update(patch);
  }

  static follow(
    source: ColorPickerPreferenceSource
  ): () => void {
    return kPreferences.follow(source);
  }

  @property({ type: String })
  declare value: string;

  @property({ type: Boolean, reflect: true })
  declare alpha: boolean;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "hex-input"
  })
  declare hexInput: boolean;

  @property({ type: String, reflect: true })
  declare layout: ColorPickerLayout;

  @property({ type: String })
  declare space: ColorPickerSpace | undefined;

  @property({ type: String })
  declare selector: ColorPickerSelector | undefined;

  @property({ type: String })
  declare channels: ColorPickerChannels | undefined;

  @property({ type: String })
  declare harmony: ColorPickerHarmony | undefined;

  @property({ type: Boolean })
  declare discrete: boolean | undefined;

  @property({ type: Boolean, reflect: true })
  declare settings: boolean;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({ type: Boolean, reflect: true })
  declare readonly: boolean;

  @query(".area")
  declare _area: HTMLElement;

  @query(".axis-saturation")
  declare _saturation: HTMLInputElement;

  @query("canvas.surface")
  declare _surface: HTMLCanvasElement;

  #point: HSVA = kBlack;
  #pointSpace = PickerSpace.hsv;
  #preferences: ColorPickerPreferences = COLOR_PICKER_DEFAULTS;
  #fields = new PickerFields(this, {
    point: () => this.#point,
    space: () => this.#pointSpace,
    hex: () => this.#hex,
    alpha: () => this.alpha,
    change: (point) => this.#commitPoint(point)
  });
  #settings = new PickerSettings(this, {
    preferences: () => this.#preferences,
    configure: (patch) => ColorPicker.configure(patch)
  });

  constructor() {
    super();

    this.value = ColorPicker.Defaults.value;
    this.alpha = false;
    this.hexInput = true;
    this.layout = ColorPicker.Defaults.layout;
    this.disabled = false;
    this.readonly = false;
    this.settings = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    kPreferences.attach(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    kPreferences.detach(this);
  }

  override focus(
    options?: FocusOptions
  ): void {
    this._saturation?.focus(options);
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    this.#preferences = this.#resolvePreferences();
    const space = PickerSpace.named(this.#preferences.space);
    if (space !== this.#pointSpace) {
      this.#point = this.#pointSpace.convert(this.#point, space);
      this.#pointSpace = space;
    }

    if (
      changed.has("value") ||
      changed.has("alpha")
    ) {
      this.#adoptValue();
    }
  }

  protected override updated(): void {
    paintSurface(this._surface, this.#surface);
  }

  get #wheel(): boolean {
    return this.#preferences.selector === "wheel";
  }

  get #surface(): PickerSurface {
    return this.#wheel ?
      new WheelSurface(
        this.#pointSpace,
        this.#point.v,
        this.#preferences.discrete
      ) :
      new SquareSurface(this.#pointSpace, this.#point.h);
  }

  get #settingsShown(): boolean {
    return this.settings && this.#settings.open;
  }

  #resolvePreferences(): ColorPickerPreferences {
    const shared = kPreferences.values;

    return {
      space: this.space ?? shared.space,
      selector: this.selector ?? shared.selector,
      channels: this.channels ?? shared.channels,
      harmony: this.harmony ?? shared.harmony,
      discrete: this.discrete ?? shared.discrete
    };
  }

  #adoptValue(): void {
    const incoming = parseFieldColor(this.value ?? "");
    if (incoming === null) {
      return;
    }

    if (formatHex(incoming, this.alpha) === this.#hex) {
      return;
    }

    this.#point = {
      ...this.#pointSpace.fromRgb(incoming, this.#point),
      a: this.alpha ? incoming.a : 1
    };
  }

  get #hex(): string {
    return this.#formatPoint(this.#point);
  }

  get #opaqueHex(): string {
    return this.#pointSpace.hex(this.#point);
  }

  #formatPoint(
    point: HSVA
  ): string {
    return formatHex(
      this.#pointSpace.toRgb(point),
      this.alpha
    );
  }

  protected get editable(): boolean {
    return !this.disabled && !this.readonly;
  }

  override render(): TemplateResult {
    const point = this.#point;
    const position = this.#wheel ?
      wheelPosition(point) :
      {
        x: point.s,
        y: 1 - point.v
      };

    const style = [
      `--jolly-picker-x:${position.x}`,
      `--jolly-picker-y:${position.y}`,
      `--jolly-picker-color:${this.#hex}`,
      `--jolly-picker-opaque:${this.#opaqueHex}`,
      `--jolly-picker-hue-ramp:${this.#pointSpace.hueRamp}`,
      `--jolly-picker-value-ramp:${this.#pointSpace.valueRamp(point)}`
    ].join(";");

    if (this.layout === "wide") {
      return html`
        <div class="panel" style=${style}>
          ${this.#renderArea()}
          ${this.#renderTrack(this.#wheel ? "value" : "hue")}
          ${this.alpha ? this.#renderTrack("alpha") : nothing}
          ${this.#renderChannels()}
        </div>
      `;
    }

    return html`
      <div class="panel" style=${style}>
        ${this.#renderArea()}
        ${this.#renderTrack(this.#wheel ? "value" : "hue")}
        ${this.alpha ? this.#renderAlpha() : nothing}
        ${this.#settingsShown ? this.#settings.renderPanel() : this.#renderHarmony()}
        ${this.hexInput || this.settings ? this.#renderFooter(nothing) : nothing}
      </div>
    `;
  }

  #renderArea(): TemplateResult {
    const { h, s, v } = this.#point;
    if (this.#wheel) {
      const { discrete } = this.#preferences;

      return html`
        <div
          class="area wheel ${discrete ? "discrete" : ""}"
          role="group"
          aria-label="Hue and saturation"
          @pointerdown=${this.#onAreaPointerDown}
        >
          <canvas class="surface"></canvas>
          ${this.#harmonyPoints().map((point) => {
            const { x, y } = wheelPosition(point);

            return html`
              <span
                class="harmony-marker"
                style="--jolly-marker-x:${x};--jolly-marker-y:${y}"
              ></span>
            `;
          })}
          <span class="area-cursor"></span>
          ${this.#renderSlider({
            className: "axis axis-saturation",
            label: "Saturation",
            max: kAxisSteps,
            step: discrete ? kAxisSteps / DISCRETE_SATURATION_STEPS : 1,
            value: s * kAxisSteps,
            onChange: this.#onSaturation
          })}
          ${this.#renderSlider({
            className: "axis axis-hue",
            label: "Hue",
            max: kHueSteps,
            step: discrete ? DISCRETE_HUE_STEP : 1,
            value: h,
            onChange: this.#onHue
          })}
        </div>
      `;
    }

    return html`
      <div
        class="area"
        role="group"
        aria-label="Saturation and value"
        @pointerdown=${this.#onAreaPointerDown}
      >
        <canvas class="surface"></canvas>
        <span class="area-cursor"></span>
        ${this.#renderSlider({
          className: "axis axis-saturation",
          label: "Saturation",
          max: kAxisSteps,
          value: s * kAxisSteps,
          onChange: this.#onSaturation
        })}
        ${this.#renderSlider({
          className: "axis axis-value",
          label: "Value",
          max: kAxisSteps,
          value: v * kAxisSteps,
          onChange: this.#onValue
        })}
      </div>
    `;
  }

  #renderTrack(
    kind: "hue" | "value" | "alpha"
  ): TemplateResult {
    const { h, v, a } = this.#point;
    const tracks = {
      hue: [kHueSteps, h, "Hue", this.#onHue],
      value: [kAxisSteps, v * kAxisSteps, "Value", this.#onValue],
      alpha: [kAlphaSteps, a * kAlphaSteps, "Alpha", this.#onAlpha]
    } as const;
    const [max, value, label, onChange] = tracks[kind];

    return html`
      <div class="track ${kind}">
        ${this.#renderSlider({
          label,
          max,
          value,
          onChange,
          vertical: this.layout === "wide"
        })}
      </div>
    `;
  }

  #renderSlider(
    slider: SliderTemplate
  ): TemplateResult {
    return html`
      <input
        class=${slider.className ?? nothing}
        type="range"
        min="0"
        max=${slider.max}
        step=${slider.step ?? 1}
        .value=${String(Math.round(slider.value))}
        ?disabled=${this.disabled}
        aria-label=${slider.label}
        aria-orientation=${slider.vertical ? "vertical" : nothing}
        aria-readonly=${this.readonly ? "true" : nothing}
        @input=${slider.onChange}
        @change=${slider.onChange}
      >
    `;
  }

  #renderAlpha(): TemplateResult {
    return html`
      <div class="lane">
        ${this.#renderTrack("alpha")}
        ${this.#fields.renderAlphaReadout()}
      </div>
    `;
  }

  #harmonyPoints(): HSVA[] {
    const kind = this.#preferences.harmony;
    if (kind === "none") {
      return [];
    }

    return colorHarmony(this.#point, kind).slice(1);
  }

  #renderHarmony(): TemplateResult | typeof nothing {
    const points = this.#harmonyPoints();
    if (points.length === 0) {
      return nothing;
    }

    return html`
      <div
        class="harmony"
        role="group"
        aria-label="Color harmony"
        title="Click to use, right click for the secondary color"
      >
        ${points.map((point) => {
          const hex = this.#formatPoint(point);

          return html`
            <button
              class="harmony-swatch"
              type="button"
              style="--jolly-harmony-color:${this.#pointSpace.hex(point)}"
              aria-label=${`Harmony color ${hex}`}
              ?disabled=${!this.editable}
              @click=${() => this.#commitPoint(point)}
              @contextmenu=${(event: MouseEvent) => {
                event.preventDefault();
                this.#emitSecondary(point);
              }}
            ></button>
          `;
        })}
      </div>
    `;
  }

  #renderChannels(): TemplateResult {
    const values = channelValues(this.#point, this.#pointSpace);
    const rows = CHANNEL_ROWS[this.#preferences.channels];

    return html`
      <div class="channels">
        ${this.#settingsShown ? this.#settings.renderPanel() : html`
          ${rows.map(([left, right]) => html`
            ${this.#fields.renderChannel(left, values)}
            ${this.#fields.renderChannel(right, values)}
          `)}
          ${this.#renderHarmony()}
        `}
        ${this.hexInput || this.alpha || this.settings ?
          this.#renderFooter(
            this.alpha ? this.#fields.renderChannel("a", values) : nothing
          ) :
          nothing}
      </div>
    `;
  }

  #renderFooter(
    alpha: TemplateResult | typeof nothing
  ): TemplateResult {
    return html`
      <div class="footer">
        ${this.hexInput ? this.#fields.renderHex() : nothing}
        ${alpha}
        ${this.settings ? this.#settings.renderToggle() : nothing}
      </div>
    `;
  }

  #commitPoint(
    point: HSVA
  ): void {
    if (!this.editable) {
      return;
    }

    this.#patch(point);
    this.#commit();
  }

  #emitSecondary(
    point: HSVA
  ): void {
    if (!this.editable) {
      return;
    }

    emitComposedEvent<JollyChangeDetail<string>>(this, "jolly-secondary", {
      value: this.#formatPoint(point)
    });
  }

  #onAreaPointerDown(
    event: PointerEvent
  ): void {
    if (!this.editable || event.button !== 0) {
      return;
    }

    event.preventDefault();
    this._area.setPointerCapture(event.pointerId);
    this._saturation.focus({ preventScroll: true });
    this.#applyPointer(event);

    const onMove = (moved: PointerEvent) => this.#applyPointer(moved);
    const onUp = () => {
      this._area.removeEventListener(
        "pointermove",
        onMove
      );
      this._area.removeEventListener(
        "pointerup",
        onUp
      );
      this._area.removeEventListener(
        "pointercancel",
        onUp
      );
      this.#commit();
    };

    this._area.addEventListener(
      "pointermove",
      onMove
    );
    this._area.addEventListener(
      "pointerup",
      onUp
    );
    this._area.addEventListener(
      "pointercancel",
      onUp
    );
  }

  #applyPointer(
    event: PointerEvent
  ): void {
    const pointer = {
      x: event.clientX,
      y: event.clientY
    };
    const rect = this._area.getBoundingClientRect();

    if (this.#wheel) {
      const picked = hueSaturationFromPointer(pointer, rect);
      this.#patch(this.#preferences.discrete ? snapToWheel(picked) : picked);
    }
    else {
      this.#patch(saturationValueFromPointer(pointer, rect));
    }
    this.#stream();
  }

  #onSaturation(
    event: Event
  ): void {
    this.#applyAxis(
      event,
      (ratio) => {
        return { s: ratio / kAxisSteps };
      }
    );
  }

  #onValue(
    event: Event
  ): void {
    this.#applyAxis(
      event,
      (ratio) => {
        return { v: ratio / kAxisSteps };
      }
    );
  }

  #onHue(
    event: Event
  ): void {
    this.#applyAxis(
      event,
      (raw) => {
        return { h: raw };
      }
    );
  }

  #onAlpha(
    event: Event
  ): void {
    this.#applyAxis(
      event,
      (raw) => {
        return { a: raw / kAlphaSteps };
      }
    );
  }

  #applyAxis(
    event: Event,
    toPatch: (raw: number) => Partial<HSVA>
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    if (!this.editable) {
      this.requestUpdate();

      return;
    }

    this.#patch(toPatch(Number(event.target.value)));

    if (event.type === "change") {
      this.#commit();
    }
    else {
      this.#stream();
    }
  }

  #patch(
    patch: Partial<HSVA>
  ): void {
    this.#point = {
      ...this.#point,
      ...patch
    };
    this.#fields.clear();
    this.requestUpdate();
  }

  #stream(): void {
    emitFieldEvent(
      this,
      "jolly-input",
      this.#hex
    );
  }

  #commit(): void {
    emitFieldEvent(
      this,
      "jolly-change",
      this.#hex
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-color-picker": ColorPicker;
  }
}
