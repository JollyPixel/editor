// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { styleMap } from "lit/directives/style-map.js";
import {
  FrameUpdateController,
  SubscriptionController,
  readDetail,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import type { DriveSession } from "@jolly-pixel/ui/network";
import "@jolly-pixel/ui/elements/avatar";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/slider";
import "@jolly-pixel/ui/elements/message";

// Import Internal Dependencies
import "../icons.ts";
import type { ModelCollaboration } from "../collaboration/ModelCollaboration.ts";
import {
  PLAYBACK_SPEEDS,
  type AnimationPlayer,
  type PlaybackSpeed
} from "../player/AnimationPlayer.ts";

// CONSTANTS
const kSpeeds: JollyOption<PlaybackSpeed>[] = PLAYBACK_SPEEDS.map((speed) => {
  return {
    value: speed,
    label: `${speed}×`
  };
});

export class ModelAnimate extends LitElement {
  #player = new SubscriptionController<AnimationPlayer>(this, (player) => [
    player.subscribe("change", () => this.requestUpdate())
  ]);
  #collaboration = new SubscriptionController<ModelCollaboration>(
    this,
    (collaboration) => [
      collaboration.subscribe("change", () => this.requestUpdate())
    ]
  );
  #frames = new FrameUpdateController(this);

  #onClip = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      this.#collaboration.attached.select(detail.value);
    }
  };

  #onSeek = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<number>>(event);
    if (detail !== null) {
      this.#collaboration.attached.seek(detail.value);
    }
  };

  #onSpeed = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<PlaybackSpeed>>(event);
    if (detail !== null) {
      this.#collaboration.attached.changeSpeed(detail.value);
    }
  };

  static override styles = css`
    :host {
      display: block;
      color: var(--jolly-text);
    }

    .clip,
    .controls,
    .driver {
      display: flex;
      gap: var(--jolly-space-1);
      align-items: center;
      padding: var(--jolly-space-1) var(--jolly-space-2);
    }

    .clip jolly-select {
      flex: 1;
      min-inline-size: 0;
    }

    .speed {
      inline-size: 64px;
      margin-inline-start: auto;
    }

    .seek {
      display: flex;
      gap: var(--jolly-space-2);
      align-items: center;
      padding: 0 var(--jolly-space-2) var(--jolly-space-1);
    }

    jolly-slider {
      flex: 1;
      min-inline-size: 0;
    }

    .duration {
      color: var(--jolly-text-muted);
      font-variant-numeric: var(--jolly-font-numeric);
      white-space: nowrap;
    }

    .driver {
      gap: var(--jolly-space-2);

      --jolly-avatar-size: 20px;
    }

    .driver span {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  attach(
    player: AnimationPlayer,
    collaboration: ModelCollaboration
  ): void {
    this.#player.attach(player);
    this.#collaboration.attach(collaboration);
  }

  protected override updated(): void {
    if (this.#player.current?.playing === true) {
      this.#frames.schedule();
    }
  }

  override render(): TemplateResult {
    return html`
      <jolly-folder
        key="playback"
        label="Playback"
        storage-key="model:folder:playback"
        flush
      >
        ${this.#renderPlayback()}
      </jolly-folder>
    `;
  }

  #renderPlayback(): TemplateResult | typeof nothing {
    const player = this.#player.current;
    const collaboration = this.#collaboration.current;
    if (player === null || collaboration === null) {
      return nothing;
    }
    if (player.clips.length === 0) {
      return html`<jolly-message>This model has no animation.</jolly-message>`;
    }

    return html`
      ${this.#renderClip(player)}
      ${this.#renderControls(player, collaboration)}
      ${this.#renderSeek(player)}
      ${this.#renderDriver(collaboration.session)}
    `;
  }

  #renderClip(
    player: AnimationPlayer
  ): TemplateResult {
    const options: JollyOption<string>[] = player.clips.map((clip) => {
      return {
        value: clip.name,
        label: `${clip.name || "(unnamed)"} (${seconds(clip.duration)})`
      };
    });

    return html`
      <div class="clip">
        <jolly-select
          data-tool="clip"
          aria-label="Clip"
          title="Clip"
          .options=${options}
          .value=${player.selected}
          @jolly-change=${this.#onClip}
        ></jolly-select>
      </div>
    `;
  }

  #renderControls(
    player: AnimationPlayer,
    collaboration: ModelCollaboration
  ): TemplateResult {
    const { playing, loop } = player;
    const playLabel = playing ? "Pause" : "Play";

    return html`
      <div class="controls" role="toolbar" aria-label="Playback">
        <jolly-button
          data-tool="play"
          icon=${playing ? "pause" : "play"}
          label=${playLabel}
          title=${playLabel}
          icon-only
          @click=${() => collaboration.toggle()}
        ></jolly-button>
        <jolly-button
          data-tool="stop"
          icon="stop"
          label="Stop"
          title="Stop"
          icon-only
          @click=${() => collaboration.stop()}
        ></jolly-button>
        <jolly-button
          data-tool="loop"
          icon="loop"
          label="Loop"
          title="Loop"
          icon-only
          variant=${loop ? "accent" : "default"}
          .pressed=${loop}
          @click=${() => collaboration.toggleLoop()}
        ></jolly-button>
        <jolly-select
          class="speed"
          data-tool="speed"
          aria-label="Speed"
          title="Speed"
          .options=${kSpeeds}
          .value=${player.speed}
          @jolly-change=${this.#onSpeed}
        ></jolly-select>
        ${this.#renderDriveButton(collaboration.session)}
      </div>
    `;
  }

  #renderSeek(
    player: AnimationPlayer
  ): TemplateResult {
    return html`
      <div class="seek">
        <jolly-slider
          data-tool="seek"
          aria-label="Time in seconds"
          min="0"
          step="0.01"
          .max=${player.duration}
          .value=${Math.round(player.time * 100) / 100}
          @jolly-input=${this.#onSeek}
          @jolly-change=${this.#onSeek}
        ></jolly-slider>
        <span class="duration">/ ${seconds(player.duration)}</span>
      </div>
    `;
  }

  #renderDriveButton(
    session: DriveSession
  ): TemplateResult | typeof nothing {
    const { kind } = session.stance;
    if (kind !== "open" && kind !== "driving") {
      return nothing;
    }

    const driving = kind === "driving";
    const label = driving ? "Stop driving" : "Drive playback";

    return html`
      <jolly-button
        data-tool="drive"
        icon="model-drive"
        label=${label}
        title=${label}
        icon-only
        variant=${driving ? "accent" : "default"}
        .pressed=${driving}
        @click=${() => (driving ? session.release() : session.drive())}
      ></jolly-button>
    `;
  }

  #renderDriver(
    session: DriveSession
  ): TemplateResult | typeof nothing {
    const { stance } = session;
    if (stance.kind !== "following") {
      return nothing;
    }

    const { driver, joined } = stance;

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
          data-tool="watch"
          icon="model-watch"
          variant=${joined ? "accent" : "default"}
          .pressed=${joined}
          @click=${() => (joined ? session.leave() : session.join())}
        >${joined ? "Stop watching" : "Watch along"}</jolly-button>
      </div>
    `;
  }
}

function seconds(
  value: number
): string {
  return `${value.toFixed(2)} s`;
}

customElements.define("jolly-model-animate", ModelAnimate);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-animate": ModelAnimate;
  }
}
