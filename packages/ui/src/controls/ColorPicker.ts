// Import Third-party Dependencies
import {
  formatHex,
  hsvToRgb,
  rgbToHsv,
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
  applyChannel,
  channelValues,
  CHANNEL_BOUNDS,
  type ChannelValues,
  type ColorChannel
} from "../color/channels.ts";
import { parseFieldColor } from "../color/draft.ts";
import { colorPickerStyles } from "./ColorPicker.styles.ts";
import { emitFieldEvent } from "../field/events.ts";
import { DraftController } from "../field/DraftController.ts";
import {
  formatNumber,
  parseNumericEntry
} from "../numeric/entry.ts";
import { isInputElement } from "../dom.ts";

// CONSTANTS
const kAxisSteps = 1000;
const kHueSteps = 360;
const kAlphaSteps = 100;
const kAlphaStep = 1 / kAlphaSteps;
const kBlack: HSVA = {
  h: 0,
  s: 0,
  v: 0,
  a: 1
};
const kChannelLabels: Readonly<Record<ColorChannel, [string, string]>> = {
  r: ["R", "Red value"],
  g: ["G", "Green value"],
  b: ["B", "Blue value"],
  h: ["H", "Hue value"],
  s: ["S", "HSL saturation value"],
  l: ["L", "HSL lightness value"],
  a: ["A", "Alpha value"]
};
const kChannelRows: ReadonlyArray<[ColorChannel, ColorChannel]> = [
  ["r", "h"],
  ["g", "s"],
  ["b", "l"]
];

export type ColorPickerLayout = "stack" | "wide";

export interface ColorPickerDefaults {
  value: string;
  layout: ColorPickerLayout;
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

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({ type: Boolean, reflect: true })
  declare readonly: boolean;

  @query(".area")
  declare _area: HTMLElement;

  @query(".axis-saturation")
  declare _saturation: HTMLInputElement;

  #hsva: HSVA = kBlack;
  #draft: string | null = null;
  #alphaDraft = new DraftController<number>(this);
  #channelDrafts = new Map<ColorChannel, DraftController<number>>();
  #invalid = false;

  constructor() {
    super();

    this.value = ColorPicker.Defaults.value;
    this.alpha = false;
    this.hexInput = true;
    this.layout = ColorPicker.Defaults.layout;
    this.disabled = false;
    this.readonly = false;
  }

  override focus(
    options?: FocusOptions
  ): void {
    this._saturation?.focus(options);
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (
      changed.has("value") ||
      changed.has("alpha")
    ) {
      this.#adoptValue();
    }
  }

  #adoptValue(): void {
    const incoming = parseFieldColor(this.value ?? "");
    if (incoming === null) {
      return;
    }

    if (formatHex(incoming, this.alpha) === this.#hex) {
      return;
    }

    this.#hsva = {
      ...rgbToHsv(incoming),
      a: this.alpha ? incoming.a : 1
    };
  }

  get #hex(): string {
    return formatHex(
      hsvToRgb(this.#hsva),
      this.alpha
    );
  }

  get #opaqueHex(): string {
    return formatHex(hsvToRgb(this.#hsva));
  }

  protected get editable(): boolean {
    return !this.disabled && !this.readonly;
  }

  override render(): TemplateResult {
    const {
      h,
      s,
      v
    } = this.#hsva;

    const style = [
      `--jolly-picker-hue:${h}`,
      `--jolly-picker-x:${s}`,
      `--jolly-picker-y:${1 - v}`,
      `--jolly-picker-color:${this.#hex}`,
      `--jolly-picker-opaque:${this.#opaqueHex}`
    ].join(";");

    if (this.layout === "wide") {
      return html`
        <div class="panel" style=${style}>
          ${this.#renderArea()}
          ${this.#renderHue()}
          ${this.alpha ? this.#renderAlphaTrack() : nothing}
          ${this.#renderChannels()}
        </div>
      `;
    }

    return html`
      <div class="panel" style=${style}>
        ${this.#renderArea()}
        ${this.#renderHue()}
        ${this.alpha ? this.#renderAlpha() : nothing}
        ${this.hexInput ? this.#renderFooter() : nothing}
      </div>
    `;
  }

  #renderArea(): TemplateResult {
    const {
      s,
      v
    } = this.#hsva;

    return html`
      <div
        class="area"
        role="group"
        aria-label="Saturation and value"
        @pointerdown=${this.#onAreaPointerDown}
      >
        <span class="area-cursor"></span>
        <input
          class="axis axis-saturation"
          type="range"
          min="0"
          max=${kAxisSteps}
          .value=${String(Math.round(s * kAxisSteps))}
          ?disabled=${this.disabled}
          aria-label="Saturation"
          aria-readonly=${this.readonly ? "true" : nothing}
          @input=${this.#onSaturation}
          @change=${this.#onSaturation}
        >
        <input
          class="axis axis-value"
          type="range"
          min="0"
          max=${kAxisSteps}
          .value=${String(Math.round(v * kAxisSteps))}
          ?disabled=${this.disabled}
          aria-label="Value"
          aria-readonly=${this.readonly ? "true" : nothing}
          @input=${this.#onValue}
          @change=${this.#onValue}
        >
      </div>
    `;
  }

  #renderHue(): TemplateResult {
    return html`
      <div class="track hue">
        <input
          type="range"
          min="0"
          max=${kHueSteps}
          step="1"
          .value=${String(Math.round(this.#hsva.h))}
          ?disabled=${this.disabled}
          aria-label="Hue"
          aria-orientation=${this.layout === "wide" ? "vertical" : nothing}
          aria-readonly=${this.readonly ? "true" : nothing}
          @input=${this.#onHue}
          @change=${this.#onHue}
        >
      </div>
    `;
  }

  #renderAlphaTrack(): TemplateResult {
    return html`
      <div class="track alpha">
        <input
          type="range"
          min="0"
          max=${kAlphaSteps}
          step="1"
          .value=${String(Math.round(this.#hsva.a * kAlphaSteps))}
          ?disabled=${this.disabled}
          aria-label="Alpha"
          aria-orientation=${this.layout === "wide" ? "vertical" : nothing}
          aria-readonly=${this.readonly ? "true" : nothing}
          @input=${this.#onAlpha}
          @change=${this.#onAlpha}
        >
      </div>
    `;
  }

  #renderAlpha(): TemplateResult {
    return html`
      <div class="lane">
        ${this.#renderAlphaTrack()}
        <input
          class="readout"
          type="text"
          inputmode="decimal"
          spellcheck="false"
          aria-label="Alpha value"
          .value=${this.#alphaDraft.draft ?? formatNumber(this.#hsva.a, kAlphaStep)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          @input=${this.#onAlphaType}
          @keydown=${this.#onAlphaKeyDown}
          @blur=${this.#onAlphaBlur}
        >
      </div>
    `;
  }

  #renderChannels(): TemplateResult {
    const values = channelValues(this.#hsva);
    const hasFooter = this.hexInput || this.alpha;

    return html`
      <div class="channels">
        ${kChannelRows.map(([left, right]) => html`
          ${this.#renderChannel(left, values)}
          ${this.#renderChannel(right, values)}
        `)}
        ${hasFooter ? html`
          <div class="footer">
            ${this.hexInput ? this.#renderHexControls() : nothing}
            ${this.alpha ? this.#renderChannel("a", values) : nothing}
          </div>
        ` : nothing}
      </div>
    `;
  }

  #renderChannel(
    channel: ColorChannel,
    values: ChannelValues
  ): TemplateResult {
    const [name, label] = kChannelLabels[channel];
    const draft = this.#channelDraft(channel);

    return html`
      <label class="channel">
        <span class="channel-name" aria-hidden="true">${name}</span>
        <input
          class="readout"
          type="text"
          inputmode="decimal"
          spellcheck="false"
          data-channel=${channel}
          aria-label=${label}
          aria-invalid=${draft.error === null ? nothing : "true"}
          .value=${draft.draft ?? String(values[channel])}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          @input=${(event: Event) => draft.onInput(event)}
          @keydown=${(event: KeyboardEvent) => {
            draft.onKeyDown(event, () => this.#commitChannel(channel));
          }}
          @blur=${() => this.#commitChannel(channel)}
        >
      </label>
    `;
  }

  #channelDraft(
    channel: ColorChannel
  ): DraftController<number> {
    let draft = this.#channelDrafts.get(channel);
    if (draft === undefined) {
      draft = new DraftController<number>(this);
      this.#channelDrafts.set(channel, draft);
    }

    return draft;
  }

  #commitChannel(
    channel: ColorChannel
  ): void {
    this.#channelDraft(channel).commit(
      (draft) => parseNumericEntry(draft, CHANNEL_BOUNDS[channel]),
      this.editable,
      (value) => {
        this.#hsva = applyChannel(this.#hsva, channel, value);
        this.#patch({});
        this.#commit();
      }
    );
  }

  #onAlphaType(
    event: Event
  ): void {
    this.#alphaDraft.onInput(event);
  }

  #onAlphaKeyDown(
    event: KeyboardEvent
  ): void {
    this.#alphaDraft.onKeyDown(
      event,
      () => this.#commitAlpha()
    );
  }

  #onAlphaBlur(): void {
    this.#commitAlpha();
  }

  #commitAlpha(): void {
    this.#alphaDraft.commit(
      (draft) => {
        const result = parseNumericEntry(draft, {
          step: kAlphaStep,
          min: 0,
          max: 1
        });

        return result?.ok ? result : null;
      },
      this.editable,
      (alpha) => {
        this.#patch({ a: alpha });
        this.#commit();
      }
    );
  }

  #renderFooter(): TemplateResult {
    return html`
      <div class="footer">
        ${this.#renderHexControls()}
      </div>
    `;
  }

  #renderHexControls(): TemplateResult {
    return html`
      <span class="preview checker">
        <span class="preview-face"></span>
      </span>
      <input
        class="hex"
        type="text"
        spellcheck="false"
        aria-label="Hex value"
        aria-invalid=${this.#invalid ? "true" : nothing}
        .value=${this.#draft ?? this.#hex}
        ?disabled=${this.disabled}
        ?readonly=${this.readonly}
        @input=${this.#onHexType}
        @keydown=${this.#onHexKeyDown}
        @blur=${this.#onHexBlur}
      >
    `;
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
    const {
      s,
      v
    } = saturationValueFromPointer(
      {
        x: event.clientX,
        y: event.clientY
      },
      this._area.getBoundingClientRect()
    );

    this.#patch({
      s,
      v
    });
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
    this.#hsva = {
      ...this.#hsva,
      ...patch
    };
    this.#draft = null;
    this.#alphaDraft.clear();
    for (const draft of this.#channelDrafts.values()) {
      draft.clear();
    }
    this.#invalid = false;
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

  #onHexType(
    event: Event
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    this.#draft = event.target.value;
    this.#invalid = false;
    this.requestUpdate();
  }

  #onHexKeyDown(
    event: KeyboardEvent
  ): void {
    if (event.key === "Enter") {
      this.#commitHex();
    }
    else if (event.key === "Escape") {
      event.stopPropagation();
      this.#draft = null;
      this.#invalid = false;
      this.requestUpdate();
    }
  }

  #onHexBlur(): void {
    this.#commitHex();
  }

  #commitHex(): void {
    const draft = this.#draft;
    if (draft === null || !this.editable) {
      return;
    }

    const parsed = parseFieldColor(draft);
    if (parsed === null) {
      this.#invalid = true;
      this.requestUpdate();

      return;
    }

    this.#hsva = {
      ...rgbToHsv(parsed),
      a: this.alpha ? parsed.a : 1
    };
    this.#draft = null;
    this.#invalid = false;
    this.requestUpdate();
    this.#commit();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-color-picker": ColorPicker;
  }
}
