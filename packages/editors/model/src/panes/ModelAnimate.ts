// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  FrameUpdateController,
  SubscriptionController,
  readDetail,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/slider";

// Import Internal Dependencies
import "../icons.ts";
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
  #frames = new FrameUpdateController(this);

  #onSeek = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<number>>(event);
    if (detail !== null) {
      this.#player.attached.seek(detail.value);
    }
  };

  #onSpeed = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<PlaybackSpeed>>(event);
    if (detail !== null) {
      this.#player.attached.speed = detail.value;
    }
  };

  static override styles = css`
    :host {
      display: block;
      color: var(--jolly-text);
    }

    .controls {
      display: flex;
      gap: var(--jolly-space-1);
      align-items: center;
      padding: var(--jolly-space-1) var(--jolly-space-2);
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

    ul {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    button {
      display: flex;
      gap: var(--jolly-space-2);
      align-items: center;
      inline-size: 100%;
      padding: var(--jolly-space-1) var(--jolly-space-2);
      border: none;
      border-radius: var(--jolly-radius-sm);
      color: inherit;
      background: none;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    button:hover {
      background: var(--jolly-control-bg-hover);
    }

    button[aria-pressed="true"] {
      background: var(--jolly-control-bg-focus);
    }

    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .duration,
    .empty {
      color: var(--jolly-text-muted);
      font-variant-numeric: var(--jolly-font-numeric);
      white-space: nowrap;
    }

    .empty {
      margin: 0;
      padding: var(--jolly-space-1) var(--jolly-space-2);
    }
  `;

  attach(
    player: AnimationPlayer
  ): void {
    this.#player.attach(player);
  }

  protected override updated(): void {
    if (this.#player.current?.playing === true) {
      this.#frames.schedule();
    }
  }

  override render(): TemplateResult {
    const player = this.#player.current;

    return html`
      <jolly-folder
        key="playback"
        label="Playback"
        storage-key="model:folder:playback"
        flush
      >
        ${this.#renderControls(player)}
      </jolly-folder>
      <jolly-folder
        key="clips"
        label="Clips"
        storage-key="model:folder:clips"
        flush
      >
        ${this.#renderClips(player)}
      </jolly-folder>
    `;
  }

  #renderControls(
    player: AnimationPlayer | null
  ): TemplateResult {
    const playing = player?.playing ?? false;
    const disabled = player === null || player.selected === null;
    const playLabel = playing ? "Pause" : "Play";
    const loop = player?.loop ?? false;

    return html`
      <div class="controls" role="toolbar" aria-label="Playback">
        <jolly-button
          data-tool="play"
          icon=${playing ? "model-pause" : "model-play"}
          label=${playLabel}
          title=${playLabel}
          icon-only
          ?disabled=${disabled}
          @click=${() => player?.toggle()}
        ></jolly-button>
        <jolly-button
          data-tool="stop"
          icon="model-stop"
          label="Stop"
          title="Stop"
          icon-only
          ?disabled=${disabled}
          @click=${() => player?.stop()}
        ></jolly-button>
        <jolly-button
          data-tool="loop"
          icon="model-loop"
          label="Loop"
          title="Loop"
          icon-only
          variant=${loop ? "accent" : "default"}
          .pressed=${loop}
          ?disabled=${disabled}
          @click=${() => this.#toggleLoop()}
        ></jolly-button>
        <jolly-select
          class="speed"
          data-tool="speed"
          aria-label="Speed"
          title="Speed"
          .options=${kSpeeds}
          .value=${player?.speed ?? 1}
          ?disabled=${disabled}
          @jolly-change=${this.#onSpeed}
        ></jolly-select>
      </div>
      <div class="seek">
        <jolly-slider
          data-tool="seek"
          aria-label="Time in seconds"
          min="0"
          step="0.01"
          .max=${player?.duration ?? 0}
          .value=${Math.round((player?.time ?? 0) * 100) / 100}
          ?disabled=${disabled}
          @jolly-input=${this.#onSeek}
          @jolly-change=${this.#onSeek}
        ></jolly-slider>
        <span class="duration">/ ${seconds(player?.duration ?? 0)}</span>
      </div>
    `;
  }

  #renderClips(
    player: AnimationPlayer | null
  ): TemplateResult {
    const clips = player?.clips ?? [];
    if (player === null || clips.length === 0) {
      return html`<p class="empty">This model has no animation.</p>`;
    }

    return html`
      <ul aria-label="Animation clips">
        ${clips.map((clip) => html`
          <li>
            <button
              type="button"
              data-clip=${clip.name}
              title="Double-click to play"
              aria-pressed=${clip.name === player.selected}
              @click=${() => player.select(clip.name)}
              @dblclick=${() => player.play()}
            >
              <span class="name">${clip.name || "(unnamed)"}</span>
              <span class="duration">${seconds(clip.duration)}</span>
            </button>
          </li>
        `)}
      </ul>
    `;
  }

  #toggleLoop(): void {
    const player = this.#player.current;
    if (player !== null) {
      player.loop = !player.loop;
    }
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
