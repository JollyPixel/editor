// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/tool-button";

// Import Internal Dependencies
import "../app/soundIcons.ts";
import {
  EMPTY_READOUT,
  type SoundPlayer,
  type SoundReadout
} from "../playback/SoundPlayer.ts";
import { soundTrackStyles } from "./SoundTrack.styles.ts";

// CONSTANTS
const kMessages = {
  empty: "This sound is empty.",
  undecodable: "This browser cannot decode the sound."
} as const;

export class SoundTrack extends LitElement {
  #player = new SubscriptionController<SoundPlayer>(this, (player) => [
    player.subscribe("change", () => this.requestUpdate()),
    player.subscribe("sound", () => this.#drawWaveform())
  ]);
  #resize = new ResizeObserver(() => this.#drawWaveform());
  #frame: number | null = null;

  static override styles = soundTrackStyles;

  attach(
    player: SoundPlayer
  ): void {
    this.#player.attach(player);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize.disconnect();
    this.#cancelFrame();
  }

  protected override firstUpdated(): void {
    const track = this.renderRoot.querySelector(".track");
    if (track !== null) {
      this.#resize.observe(track);
    }
  }

  protected override updated(): void {
    if (this.#player.current?.playing === true) {
      this.#frame ??= requestAnimationFrame(() => {
        this.#frame = null;
        this.requestUpdate();
      });
    }
    else {
      this.#cancelFrame();
    }
  }

  override render(): TemplateResult {
    const player = this.#player.current;
    const readout = player?.readout() ?? EMPTY_READOUT;

    return html`
      <div class="transport" role="toolbar" aria-label="Playback">
        ${player === null ? nothing : this.#renderTransport(player, readout)}
        <span class="time">${readout.time}</span>
        <span class="format">${readout.format ?? nothing}</span>
      </div>
      <div class="track">
        <canvas></canvas>
        ${readout.playhead === null ? nothing : html`
          <div
            class="playhead"
            style="left: ${readout.playhead * 100}%"
          ></div>
        `}
        ${readout.status === "ready" ? nothing : html`
          <div class="message">${kMessages[readout.status]}</div>
        `}
      </div>
    `;
  }

  #renderTransport(
    player: SoundPlayer,
    readout: SoundReadout
  ): TemplateResult {
    const { playing } = player;

    return html`
      <jolly-tool-button
        data-tool="play"
        icon=${playing ? "sound-stop" : "sound-play"}
        label=${playing ? "Stop" : "Play"}
        ?disabled=${readout.status !== "ready"}
        @click=${() => (playing ? player.stop() : player.play())}
      ></jolly-tool-button>
      <jolly-tool-button
        data-tool="loop"
        icon="sound-loop"
        label="Loop"
        ?active=${player.loop}
        @click=${() => {
          player.loop = !player.loop;
        }}
      ></jolly-tool-button>
    `;
  }

  #drawWaveform(): void {
    const canvas = this.renderRoot.querySelector("canvas");
    if (canvas === null) {
      return;
    }

    const ratio = window.devicePixelRatio;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = getComputedStyle(canvas).color;
    const bars = this.#player.current?.waveform(
      canvas.width,
      canvas.height
    ) ?? [];
    bars.forEach((bar, column) => {
      context.fillRect(column, bar.top, 1, bar.height);
    });
  }

  #cancelFrame(): void {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }
}

customElements.define("jolly-sound-track", SoundTrack);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-sound-track": SoundTrack;
  }
}
