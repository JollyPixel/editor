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
import { saturationValueFromPointer } from "../color/area.ts";
import { formatHex } from "../color/format.ts";
import {
  hsvToRgb,
  rgbToHsv
} from "../color/hsv.ts";
import { parseColor } from "../color/parse.ts";
import type { HSVA } from "../color/types.ts";
import { colorPickerStyles } from "./ColorPicker.styles.ts";
import { emitFieldEvent } from "../field/events.ts";
import {
  formatNumber,
  parseNumeric,
  quantize
} from "../numeric/format.ts";
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

export interface ColorPickerDefaults {
  value: string;
}

/**
 * Controlled saturation and value picker with hue, alpha, and hex controls.
 * Emits `jolly-input` during edits and `jolly-change` on commit.
 *
 * @fires {CustomEvent<JollyChangeDetail<string>>} jolly-input
 * @fires {CustomEvent<JollyChangeDetail<string>>} jolly-change
 */
@customElement("jolly-color-picker")
export class ColorPicker extends LitElement {
  static readonly Defaults: ColorPickerDefaults = {
    value: "#000000"
  };

  static override styles = [
    colorPickerStyles
  ];

  @property({ type: String })
  declare value: string;

  @property({ type: Boolean, reflect: true })
  declare alpha: boolean;

  /**
   * Shows the preview and hex field. Disable when the host supplies one.
   */
  @property({
    type: Boolean,
    reflect: true,
    attribute: "hex-input"
  })
  declare hexInput: boolean;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({ type: Boolean, reflect: true })
  declare readonly: boolean;

  @query(".area")
  declare _area: HTMLElement;

  @query(".axis-saturation")
  declare _saturation: HTMLInputElement;

  /**
   * Preserves hue and saturation when hex cannot represent them.
   */
  #hsva: HSVA = kBlack;
  #draft: string | null = null;
  #alphaDraft: string | null = null;
  #invalid = false;

  constructor() {
    super();

    this.value = ColorPicker.Defaults.value;
    this.alpha = false;
    this.hexInput = true;
    this.disabled = false;
    this.readonly = false;
  }

  /**
   * Focuses the saturation control.
   */
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

  /**
   * Preserves held HSVA during write-back. External values replace it.
   */
  #adoptValue(): void {
    const incoming = parseColor(this.value ?? "");
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

  /**
   * Opaque current colour for the alpha ramp.
   */
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
          aria-readonly=${this.readonly ? "true" : nothing}
          @input=${this.#onHue}
          @change=${this.#onHue}
        >
      </div>
    `;
  }

  #renderAlpha(): TemplateResult {
    return html`
      <div class="lane">
        <div class="track alpha">
          <input
            type="range"
            min="0"
            max=${kAlphaSteps}
            step="1"
            .value=${String(Math.round(this.#hsva.a * kAlphaSteps))}
            ?disabled=${this.disabled}
            aria-label="Alpha"
            aria-readonly=${this.readonly ? "true" : nothing}
            @input=${this.#onAlpha}
            @change=${this.#onAlpha}
          >
        </div>
        <input
          class="readout"
          type="text"
          inputmode="decimal"
          spellcheck="false"
          aria-label="Alpha value"
          .value=${this.#alphaDraft ?? formatNumber(this.#hsva.a, kAlphaStep)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          @input=${this.#onAlphaType}
          @keydown=${this.#onAlphaKeyDown}
          @blur=${this.#onAlphaBlur}
        >
      </div>
    `;
  }

  #onAlphaType(
    event: Event
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    this.#alphaDraft = event.target.value;
    this.requestUpdate();
  }

  #onAlphaKeyDown(
    event: KeyboardEvent
  ): void {
    if (event.key === "Enter") {
      this.#commitAlpha();
    }
    else if (event.key === "Escape") {
      // Keep the parent popover open while discarding the draft.
      event.stopPropagation();
      this.#alphaDraft = null;
      this.requestUpdate();
    }
  }

  #onAlphaBlur(): void {
    this.#commitAlpha();
  }

  #commitAlpha(): void {
    const draft = this.#alphaDraft;
    if (draft === null || !this.editable) {
      return;
    }

    const result = parseNumeric(draft);
    this.#alphaDraft = null;

    // Invalid input restores the last committed alpha.
    if (result === null || !result.ok) {
      this.requestUpdate();

      return;
    }

    this.#patch({
      a: quantize(
        result.value,
        kAlphaStep,
        0,
        1
      )
    });
    this.#commit();
  }

  #renderFooter(): TemplateResult {
    return html`
      <div class="footer">
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
      </div>
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
    // Continue the active pointer gesture from the keyboard.
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

  /**
   * Restores rejected range input because native ranges lack `readonly`.
   */
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
    this.#alphaDraft = null;
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
      // Keep the parent popover open while discarding the draft.
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

    const parsed = parseColor(draft);
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
