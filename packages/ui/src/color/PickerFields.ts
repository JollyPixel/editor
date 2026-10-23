// Import Third-party Dependencies
import type { HSVA } from "@jolly-pixel/color";
import {
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import {
  applyChannel,
  CHANNEL_BOUNDS,
  type ChannelValues,
  type ColorChannel
} from "./channels.ts";
import { parseFieldColor } from "./draft.ts";
import type { PickerSpace } from "./space.ts";
import { DraftController } from "../field/DraftController.ts";
import {
  formatNumber,
  parseNumericEntry
} from "../numeric/entry.ts";
import { isInputElement } from "../dom.ts";

// CONSTANTS
const kAlphaStep = 1 / 100;
const kChannelLabels: Readonly<Record<ColorChannel, [string, string]>> = {
  r: ["R", "Red value"],
  g: ["G", "Green value"],
  b: ["B", "Blue value"],
  h: ["H", "Hue value"],
  s: ["S", "HSL saturation value"],
  l: ["L", "HSL lightness value"],
  okl: ["L", "OKLCH lightness value"],
  okc: ["C", "OKLCH chroma value"],
  okh: ["H", "OKLCH hue value"],
  a: ["A", "Alpha value"]
};

export interface PickerFieldsHost extends ReactiveControllerHost {
  disabled: boolean;
  readonly: boolean;
}

export interface PickerFieldsOptions {
  point(): HSVA;
  space(): PickerSpace;
  hex(): string;
  alpha(): boolean;
  change(point: HSVA): void;
}

export class PickerFields {
  readonly #host: PickerFieldsHost;
  readonly #options: PickerFieldsOptions;
  readonly #alphaDraft: DraftController<number>;
  readonly #channelDrafts = new Map<ColorChannel, DraftController<number>>();
  #hexDraft: string | null = null;
  #invalid = false;

  constructor(
    host: PickerFieldsHost,
    options: PickerFieldsOptions
  ) {
    this.#host = host;
    this.#options = options;
    this.#alphaDraft = new DraftController<number>(host);
  }

  get #editable(): boolean {
    return !this.#host.disabled && !this.#host.readonly;
  }

  clear(): void {
    this.#hexDraft = null;
    this.#invalid = false;
    this.#alphaDraft.clear();
    for (const draft of this.#channelDrafts.values()) {
      draft.clear();
    }
  }

  renderChannel(
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
          ?disabled=${this.#host.disabled}
          ?readonly=${this.#host.readonly}
          @input=${(event: Event) => draft.onInput(event)}
          @keydown=${(event: KeyboardEvent) => {
            draft.onKeyDown(event, () => this.#commitChannel(channel));
          }}
          @blur=${() => this.#commitChannel(channel)}
        >
      </label>
    `;
  }

  renderAlphaReadout(): TemplateResult {
    return html`
      <input
        class="readout"
        type="text"
        inputmode="decimal"
        spellcheck="false"
        aria-label="Alpha value"
        .value=${this.#alphaDraft.draft ?? formatNumber(this.#options.point().a, kAlphaStep)}
        ?disabled=${this.#host.disabled}
        ?readonly=${this.#host.readonly}
        @input=${(event: Event) => this.#alphaDraft.onInput(event)}
        @keydown=${(event: KeyboardEvent) => {
          this.#alphaDraft.onKeyDown(event, () => this.#commitAlpha());
        }}
        @blur=${() => this.#commitAlpha()}
      >
    `;
  }

  renderHex(): TemplateResult {
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
        .value=${this.#hexDraft ?? this.#options.hex()}
        ?disabled=${this.#host.disabled}
        ?readonly=${this.#host.readonly}
        @input=${this.#onHexType}
        @keydown=${this.#onHexKeyDown}
        @blur=${() => this.#commitHex()}
      >
    `;
  }

  #channelDraft(
    channel: ColorChannel
  ): DraftController<number> {
    let draft = this.#channelDrafts.get(channel);
    if (draft === undefined) {
      draft = new DraftController<number>(this.#host);
      this.#channelDrafts.set(channel, draft);
    }

    return draft;
  }

  #commitChannel(
    channel: ColorChannel
  ): void {
    this.#channelDraft(channel).commit(
      (draft) => parseNumericEntry(draft, CHANNEL_BOUNDS[channel]),
      this.#editable,
      (value) => {
        this.#options.change(applyChannel(
          this.#options.point(),
          channel,
          value,
          this.#options.space()
        ));
      }
    );
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
      this.#editable,
      (alpha) => {
        this.#options.change({
          ...this.#options.point(),
          a: alpha
        });
      }
    );
  }

  readonly #onHexType = (
    event: Event
  ): void => {
    if (!isInputElement(event.target)) {
      return;
    }

    this.#hexDraft = event.target.value;
    this.#invalid = false;
    this.#host.requestUpdate();
  };

  readonly #onHexKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Enter") {
      this.#commitHex();
    }
    else if (event.key === "Escape") {
      event.stopPropagation();
      this.#hexDraft = null;
      this.#invalid = false;
      this.#host.requestUpdate();
    }
  };

  #commitHex(): void {
    const draft = this.#hexDraft;
    if (draft === null || !this.#editable) {
      return;
    }

    const parsed = parseFieldColor(draft);
    if (parsed === null) {
      this.#invalid = true;
      this.#host.requestUpdate();

      return;
    }

    this.#options.change({
      ...this.#options.space().fromRgb(parsed, this.#options.point()),
      a: this.#options.alpha() ? parsed.a : 1
    });
  }
}
