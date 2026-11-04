// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  FrameUpdateController,
  SubscriptionController,
  readDetail,
  type JollyChangeDetail,
  type JollyOption,
  type PresencePeer
} from "@jolly-pixel/ui";
import { styleMap } from "lit/directives/style-map.js";
import "@jolly-pixel/ui/elements/avatar";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/slider";

// Import Internal Dependencies
import "../../icons.ts";
import type { SoundCollaboration } from "../../collaboration/SoundCollaboration.ts";
import {
  PLAYBACK_SPEEDS,
  type PlaybackSpeed
} from "../../player/PlaybackMode.ts";
import type { SoundPlayer } from "../../player/SoundPlayer.ts";
import { Volume } from "../../player/volume/Volume.ts";
import { soundTrackStyles } from "./SoundTrack.styles.ts";

// CONSTANTS
const kSpeeds: JollyOption<PlaybackSpeed>[] = PLAYBACK_SPEEDS.map((speed) => {
  return {
    value: speed,
    label: `${speed}×`
  };
});
const kDirections: JollyOption<boolean>[] = [
  {
    value: true,
    label: "Backward",
    icon: "sound-backward"
  },
  {
    value: false,
    label: "Forward",
    icon: "sound-forward"
  }
];

export class SoundTrack extends LitElement {
  #player = new SubscriptionController<SoundPlayer>(this, (player) => [
    player.subscribe("change", () => this.requestUpdate()),
    player.subscribe("volume", () => this.requestUpdate())
  ]);
  #collaboration = new SubscriptionController<SoundCollaboration>(
    this,
    (collaboration) => [
      collaboration.subscribe("change", () => this.requestUpdate())
    ]
  );
  #frames = new FrameUpdateController(this);

  #onSpeed = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<PlaybackSpeed>>(event);
    if (detail !== null) {
      this.#collaboration.attached.retune(
        this.#player.attached.mode.withSpeed(detail.value)
      );
    }
  };

  #onDirection = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      this.#collaboration.attached.retune(
        this.#player.attached.mode.withReversed(detail.value)
      );
    }
  };

  #onVolume = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<number>>(event);
    if (detail !== null) {
      this.#player.attached.volume = Volume.percent(detail.value);
    }
  };

  static override styles = soundTrackStyles;

  attach(
    player: SoundPlayer,
    collaboration: SoundCollaboration
  ): void {
    this.#player.attach(player);
    this.#collaboration.attach(collaboration);
  }

  protected override updated(): void {
    if (this.#player.current?.playing === true) {
      this.#frames.schedule();
    }
  }

  override render(): TemplateResult | typeof nothing {
    const player = this.#player.current;
    const collaboration = this.#collaboration.current;
    if (player === null || collaboration === null) {
      return nothing;
    }

    return html`
      <div class="controls" role="toolbar" aria-label="Playback">
        ${this.#renderButtons(player, collaboration)}
        <span class="time">${player.timecode()}</span>
        ${this.#renderVolume(player)}
        ${this.#renderDrive(collaboration)}
      </div>
    `;
  }

  #renderButtons(
    player: SoundPlayer,
    collaboration: SoundCollaboration
  ): TemplateResult {
    const { playing, mode } = player;
    const { loop, reversed, speed } = mode;
    const playLabel = playing ? "Pause" : "Play";

    return html`
      <jolly-button
        data-tool="play"
        icon=${playing ? "sound-pause" : "sound-play"}
        label=${playLabel}
        title=${playLabel}
        icon-only
        ?disabled=${player.status !== "ready"}
        @click=${() => (playing ? collaboration.pause() : collaboration.play())}
      ></jolly-button>
      <jolly-button-group
        class="direction"
        data-tool="direction"
        aria-label="Direction"
        icon-only
        .options=${kDirections}
        .value=${reversed}
        @jolly-change=${this.#onDirection}
      ></jolly-button-group>
      <jolly-button
        data-tool="loop"
        icon="sound-loop"
        label="Loop"
        title="Loop"
        icon-only
        variant=${loop ? "accent" : "default"}
        .pressed=${loop}
        @click=${() => collaboration.retune(mode.withLoop(!loop))}
      ></jolly-button>
      <jolly-select
        class="speed"
        data-tool="speed"
        aria-label="Speed"
        title="Speed"
        .options=${kSpeeds}
        .value=${speed}
        @jolly-change=${this.#onSpeed}
      ></jolly-select>
    `;
  }

  #renderVolume(
    player: SoundPlayer
  ): TemplateResult {
    return html`
      <div class="volume" title="Volume">
        <jolly-icon name="sound-volume" label="Volume"></jolly-icon>
        <jolly-slider
          data-tool="volume"
          min="0"
          max="100"
          .value=${player.volume.toPercent()}
          @jolly-input=${this.#onVolume}
          @jolly-change=${this.#onVolume}
        ></jolly-slider>
      </div>
    `;
  }

  #renderDrive(
    collaboration: SoundCollaboration
  ): TemplateResult | typeof nothing {
    const { stance } = collaboration;
    switch (stance.kind) {
      case "alone":
        return nothing;
      case "open":
      case "driving":
        return this.#renderDriveButton(
          collaboration,
          stance.kind === "driving"
        );
      case "following":
        return this.#renderDriver(
          collaboration,
          stance.driver,
          stance.listening
        );
      default: {
        const unhandled: never = stance;
        throw new Error(`Unhandled sound stance: ${String(unhandled)}`);
      }
    }
  }

  #renderDriveButton(
    collaboration: SoundCollaboration,
    driving: boolean
  ): TemplateResult {
    const label = driving ? "Stop driving" : "Drive playback";

    return html`
      <jolly-button
        class="drive"
        data-tool="drive"
        icon="sound-drive"
        label=${label}
        title=${label}
        icon-only
        variant=${driving ? "accent" : "default"}
        .pressed=${driving}
        @click=${() => (driving ? collaboration.release() : collaboration.drive())}
      ></jolly-button>
    `;
  }

  #renderDriver(
    collaboration: SoundCollaboration,
    driver: PresencePeer,
    listening: boolean
  ): TemplateResult {
    return html`
      <div class="driver">
        <jolly-avatar
          peer-id=${driver.peerId ?? driver.clientId}
          .color=${driver.color}
          .image=${driver.avatar ?? ""}
        ></jolly-avatar>
        <span>
          <b style=${styleMap({ color: driver.color })}>${driver.displayName}</b>
          is driving
        </span>
        <jolly-button
          data-tool="listen"
          icon="sound-listen"
          variant=${listening ? "accent" : "default"}
          .pressed=${listening}
          @click=${() => (listening ? collaboration.leave() : collaboration.listen())}
        >${listening ? "Stop listening" : "Listen along"}</jolly-button>
      </div>
    `;
  }
}

customElements.define("jolly-sound-track", SoundTrack);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-sound-track": SoundTrack;
  }
}
