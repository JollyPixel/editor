// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { Systems } from "@jolly-pixel/ecs";
import {
  SubscriptionController,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/message";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/select";

// Import Internal Dependencies
import "../../icons.ts";
import type { SoundCollaboration } from "../../collaboration/SoundCollaboration.ts";
import type { PlaybackMode } from "../../player/PlaybackMode.ts";
import type { SoundPlayer } from "../../player/SoundPlayer.ts";
import type { LiveSettings } from "../../settings/LiveSettings.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;
type NumericSetting =
  | "volume"
  | "pitch"
  | "pitchVariation"
  | "loopStart"
  | "loopEnd"
  | "cooldown"
  | "maxInstances";
type NumericSpatialSetting = "refDistance" | "maxDistance" | "rolloffFactor";
type FieldKey =
  | NumericSetting
  | NumericSpatialSetting
  | "category"
  | "loop"
  | "distanceModel";

interface FieldCopy {
  label: string;
  description: string;
}

interface NumberRange {
  min: number;
  max?: number;
  step: number;
}

interface NumberInput extends NumberRange {
  value: number;
  default: number;
}

interface NumberEvents {
  preview(value: number): void;
  commit(value: number): void;
}

interface SelectInput<TValue> {
  options: JollyOption<TValue>[];
  value: TValue;
  default: TValue;
}

interface PreviewToggle {
  tool: string;
  icon: string;
  label: string;
  hint: string;
  on: boolean;
  next: PlaybackMode;
}

// CONSTANTS
const kApplySettingsHint = "Apply settings: play with the volume, pitch, " +
  "random pitch and loop of these settings";
const kSpatialHint = "Spatial: hear the sound from where it sits on the " +
  "Spatial pad, with the falloff of these settings";
const kLimits = Systems.SOUND_SETTINGS_LIMITS;
const kDefaults = Systems.SOUND_SETTINGS_DEFAULTS;
const kCopy: Record<FieldKey, FieldCopy> = {
  category: {
    label: "Category",
    description: "Mixer group the sound plays through. The game can change " +
      "the volume of each group or mute it."
  },
  volume: {
    label: "Volume",
    description: "0 is silent, 1 is full volume."
  },
  pitch: {
    label: "Pitch",
    description: "Playback speed. 2 plays an octave higher and twice as " +
      "fast, 0.5 an octave lower and half as fast."
  },
  pitchVariation: {
    label: "Random pitch",
    description: "Random pitch change on each play, so repeated sounds such " +
      "as footsteps do not sound identical. 0.1 plays between 0.9x and 1.1x " +
      "the pitch."
  },
  loop: {
    label: "Loop",
    description: "Repeats the sound until it is stopped."
  },
  loopStart: {
    label: "Loop start",
    description: "In seconds. The sound plays from the beginning, then " +
      "repeats from here."
  },
  loopEnd: {
    label: "Loop end",
    description: "In seconds. Where the loop jumps back to Loop start. " +
      "0 means the end of the sound."
  },
  cooldown: {
    label: "Cooldown",
    description: "Seconds after a play during which new plays of this sound " +
      "are ignored. Stops a sound triggered every frame from stacking up."
  },
  maxInstances: {
    label: "Max at once",
    description: "How many copies of this sound can play at the same time. " +
      "When a new one starts, the oldest stops. 0 means no limit."
  },
  distanceModel: {
    label: "Falloff",
    description: "How the volume drops with distance. Inverse fades fast, " +
      "then leaves a long quiet tail. Linear fades evenly down to Max " +
      "distance. Exponential fades faster than Inverse."
  },
  refDistance: {
    label: "Ref distance",
    description: "Distance in world units within which the sound plays at " +
      "full volume."
  },
  maxDistance: {
    label: "Max distance",
    description: "Distance in world units where the volume is lowest. " +
      "With a Rolloff of 1 the sound is silent from there."
  },
  rolloffFactor: {
    label: "Rolloff",
    description: "How fast the volume drops past Ref distance. Higher fades " +
      "faster, 0 keeps full volume at any distance."
  }
};
const kCategoryLabels: Record<Systems.BuiltInSoundCategory, string> = {
  music: "Music",
  sfx: "Sound effect",
  ui: "Interface",
  ambient: "Ambient",
  voice: "Voice"
};
const kDistanceModelLabels: Record<Systems.SoundDistanceModel, string> = {
  inverse: "Inverse",
  linear: "Linear",
  exponential: "Exponential"
};
const kDistanceModels = Object.values(Systems.SOUND_DISTANCE_MODELS).map(
  (value): JollyOption<Systems.SoundDistanceModel> => {
    return {
      value,
      label: kDistanceModelLabels[value]
    };
  }
);

export class SoundSettingsPane extends LitElement {
  #settings = new SubscriptionController<LiveSettings>(this, (settings) => [
    settings.subscribe("change", () => this.requestUpdate())
  ]);
  #player = new SubscriptionController<SoundPlayer>(this, (player) => [
    player.subscribe("change", () => this.requestUpdate())
  ]);
  #collaboration = new SubscriptionController<SoundCollaboration>(
    this,
    () => []
  );

  static override styles = css`
    :host {
      display: block;
      color: var(--jolly-text);

      --jolly-label-width: 18ch;
      --jolly-label-max-width: 60%;
    }
  `;

  attach(
    settings: LiveSettings,
    player: SoundPlayer,
    collaboration: SoundCollaboration
  ): void {
    this.#settings.attach(settings);
    this.#player.attach(player);
    this.#collaboration.attach(collaboration);
  }

  override render(): TemplateResult | typeof nothing {
    const live = this.#settings.current;
    const player = this.#player.current;
    const collaboration = this.#collaboration.current;
    if (
      live === null ||
      player === null ||
      collaboration === null ||
      live.document.bytes === null
    ) {
      return nothing;
    }

    return this.#renderSettings(live, player, collaboration);
  }

  #renderSettings(
    live: LiveSettings,
    player: SoundPlayer,
    collaboration: SoundCollaboration
  ): TemplateResult {
    const { mode } = player;
    function toggle(
      preview: PreviewToggle
    ): TemplateResult {
      return previewToggle(preview, () => collaboration.retune(preview.next));
    }
    const settings = live.current;
    const { spatial } = settings;
    function edit(
      toChange: (value: number) => Systems.SoundSettingsInput
    ): NumberEvents {
      return {
        preview: (value) => live.preview(toChange(value)),
        commit: (value) => live.commit(toChange(value))
      };
    }
    function field(
      key: NumericSetting,
      range: NumberRange
    ): TemplateResult {
      return numberField(kCopy[key], {
        ...range,
        value: settings[key],
        default: kDefaults[key]
      }, edit((value) => {
        return { [key]: value };
      }));
    }
    function spatialField(
      key: NumericSpatialSetting,
      range: NumberRange
    ): TemplateResult {
      return numberField(kCopy[key], {
        ...range,
        value: spatial[key],
        default: kDefaults.spatial[key]
      }, edit((value) => {
        return { spatial: { [key]: value } };
      }));
    }

    return html`
      ${folder("settings", "Playback", toggle({
        tool: "apply-settings",
        icon: "sound-tuning",
        label: "Apply settings",
        hint: kApplySettingsHint,
        on: mode.applySettings,
        next: mode.withApplySettings(!mode.applySettings)
      }), html`
        ${select(kCopy.category, {
          options: categoryOptions(settings.category),
          value: settings.category,
          default: kDefaults.category
        }, (category) => live.commit({ category }))}
        ${field("volume", { min: 0, max: 1, step: 0.05 })}
        ${field("pitch", {
          min: kLimits.minPitch,
          max: kLimits.maxPitch,
          step: 0.05
        })}
        ${field("pitchVariation", {
          min: 0,
          max: kLimits.maxPitchVariation,
          step: 0.05
        })}
        <jolly-checkbox
          label=${kCopy.loop.label}
          description=${kCopy.loop.description}
          description-display="tooltip"
          .value=${settings.loop}
          .default=${kDefaults.loop}
          @jolly-change=${(event: ChangeEvent<boolean>) => live.commit({ loop: event.detail.value })}
        ></jolly-checkbox>
        ${settings.loop ? html`
          ${field("loopStart", { min: 0, step: 0.01 })}
          ${field("loopEnd", { min: 0, step: 0.01 })}
        ` : nothing}
      `)}
      ${folder("limits", "Repeats", nothing, html`
        ${field("cooldown", { min: 0, step: 0.05 })}
        ${field("maxInstances", { min: 0, step: 1 })}
      `)}
      ${folder("spatial", "Spatial", toggle({
        tool: "spatial",
        icon: "sound-spatial",
        label: "Spatial",
        hint: kSpatialHint,
        on: mode.spatial,
        next: mode.withSpatial(!mode.spatial)
      }), html`
        <jolly-message role="note">
          Used by Audio source components with Spatial on: the volume then
          fades with the distance to the Audio listener.
        </jolly-message>
        ${select(kCopy.distanceModel, {
          options: kDistanceModels,
          value: spatial.distanceModel,
          default: kDefaults.spatial.distanceModel
        }, (distanceModel) => live.commit({ spatial: { distanceModel } }))}
        ${spatialField("refDistance", { min: 0, step: 0.5 })}
        ${spatial.distanceModel === "linear" ?
          spatialField("maxDistance", { min: 0, step: 1 }) :
          nothing}
        ${spatialField("rolloffFactor", { min: 0, step: 0.1 })}
      `)}
    `;
  }
}

function categoryOptions(
  current: string
): JollyOption<string>[] {
  const options: JollyOption<string>[] = Systems.SOUND_CATEGORIES.map((name) => {
    return {
      value: name,
      label: kCategoryLabels[name]
    };
  });

  return options.some(({ value }) => value === current) ?
    options :
    [
      ...options,
      {
        value: current,
        label: current
      }
    ];
}

function folder(
  key: string,
  label: string,
  action: TemplateResult | typeof nothing,
  content: TemplateResult
): TemplateResult {
  return html`
    <jolly-folder
      key=${key}
      label=${label}
      storage-key=${`sound:folder:${key}`}
      flush
    >
      ${action}
      ${content}
    </jolly-folder>
  `;
}

function previewToggle(
  preview: PreviewToggle,
  onClick: () => void
): TemplateResult {
  return html`
    <jolly-button
      slot="actions"
      data-tool=${preview.tool}
      icon=${preview.icon}
      label=${preview.label}
      title=${preview.hint}
      icon-only
      variant=${preview.on ? "accent" : "default"}
      .pressed=${preview.on}
      @click=${onClick}
    ></jolly-button>
  `;
}

function select<TValue extends string>(
  copy: FieldCopy,
  input: SelectInput<TValue>,
  commit: (value: TValue) => void
): TemplateResult {
  return html`
    <jolly-select
      label=${copy.label}
      description=${copy.description}
      description-display="tooltip"
      .options=${input.options}
      .value=${input.value}
      .default=${input.default}
      @jolly-change=${(event: ChangeEvent<TValue>) => commit(event.detail.value)}
    ></jolly-select>
  `;
}

function numberField(
  copy: FieldCopy,
  input: NumberInput,
  events: NumberEvents
): TemplateResult {
  return html`
    <jolly-number
      label=${copy.label}
      description=${copy.description}
      description-display="tooltip"
      .min=${input.min}
      .max=${input.max ?? Number.POSITIVE_INFINITY}
      .step=${input.step}
      .value=${input.value}
      .default=${input.default}
      @jolly-input=${(event: ChangeEvent<number>) => events.preview(event.detail.value)}
      @jolly-change=${(event: ChangeEvent<number>) => events.commit(event.detail.value)}
    ></jolly-number>
  `;
}

customElements.define("jolly-sound-settings", SoundSettingsPane);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-sound-settings": SoundSettingsPane;
  }
}
