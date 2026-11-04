// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  AmbientThemeController,
  FrameUpdateController,
  SubscriptionController
} from "@jolly-pixel/ui";
import { styleMap } from "lit/directives/style-map.js";

// Import Internal Dependencies
import type { PeerPlayhead } from "../../collaboration/Playheads.ts";
import type { SoundCollaboration } from "../../collaboration/SoundCollaboration.ts";
import type { UnplayableStatus } from "../../player/sound/UnplayableSound.ts";
import type { SoundPlayer } from "../../player/SoundPlayer.ts";
import { soundWaveStyles } from "./SoundWave.styles.ts";
import {
  PLAYHEAD_TAG_HEIGHT,
  PLAYHEAD_TAG_WIDTH,
  TagStack,
  type PlayheadTags
} from "./TagStack.ts";

// CONSTANTS
const kMessages: Record<UnplayableStatus, string> = {
  empty: "This sound is empty.",
  decoding: "Decoding the sound…",
  undecodable: "This browser cannot decode the sound."
};

export class SoundWave extends LitElement {
  #player = new SubscriptionController<SoundPlayer>(this, (player) => [
    player.subscribe("change", () => this.requestUpdate()),
    player.subscribe("sound", () => this.#drawWaveform())
  ]);
  #collaboration = new SubscriptionController<SoundCollaboration>(
    this,
    (collaboration) => [
      collaboration.subscribe("change", () => this.requestUpdate())
    ]
  );
  #theme = new AmbientThemeController(this, {
    onChange: () => this.#drawWaveform()
  });
  #frames = new FrameUpdateController(this);
  #width = 0;
  #playheads: PeerPlayhead[] = [];
  #resize = new ResizeObserver((entries) => {
    this.#width = entries[0]?.contentRect.width ?? 0;
    this.#drawWaveform();
    this.requestUpdate();
  });

  #resumeAfterScrub = false;

  #onPointerDown = (
    event: PointerEvent
  ): void => {
    const wave = event.currentTarget;
    if (
      event.button !== 0 ||
      !(wave instanceof Element) ||
      this.#player.current?.status !== "ready"
    ) {
      return;
    }

    wave.setPointerCapture(event.pointerId);
    this.#collaboration.current?.seek(SoundWave.#positionAt(wave, event));
  };

  #onPointerMove = (
    event: PointerEvent
  ): void => {
    const wave = event.currentTarget;
    const player = this.#player.current;
    const collaboration = this.#collaboration.current;
    if (
      !(wave instanceof Element) ||
      !wave.hasPointerCapture(event.pointerId) ||
      player === null ||
      collaboration === null
    ) {
      return;
    }

    if (player.playing) {
      this.#resumeAfterScrub = true;
      collaboration.pause();
    }
    collaboration.seek(SoundWave.#positionAt(wave, event));
  };

  #onScrubEnd = (): void => {
    if (this.#resumeAfterScrub) {
      this.#resumeAfterScrub = false;
      this.#collaboration.current?.play();
    }
  };

  static #positionAt(
    wave: Element,
    event: PointerEvent
  ): number {
    const bounds = wave.getBoundingClientRect();

    return (event.clientX - bounds.left) / bounds.width;
  }

  static override styles = soundWaveStyles;

  attach(
    player: SoundPlayer,
    collaboration: SoundCollaboration
  ): void {
    this.#player.attach(player);
    this.#collaboration.attach(collaboration);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#theme.follow();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize.disconnect();
  }

  protected override firstUpdated(): void {
    const canvas = this.renderRoot.querySelector("canvas");
    if (canvas !== null) {
      this.#resize.observe(canvas);
    }
  }

  protected override willUpdate(): void {
    this.#playheads = this.#collaboration.current?.playheads() ?? [];
  }

  protected override updated(): void {
    if (this.#playheads.length > 0) {
      this.#frames.schedule();
    }
  }

  override render(): TemplateResult {
    const player = this.#player.current;
    const status = player?.status ?? "empty";
    const playheads = this.#playheads;
    const tags = new TagStack(this.#width).arrange(playheads);

    return html`
      <div
        class=${status === "ready" ? "wave seekable" : "wave"}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @lostpointercapture=${this.#onScrubEnd}
      >
        <canvas></canvas>
        ${player === null ? nothing : this.#renderCursor(player)}
        ${playheads.map((playhead) => this.#renderPlayhead(playhead))}
        ${playheads.map((playhead, index) => this.#renderTags(
          playhead.position,
          tags[index]
        ))}
        ${status === "ready" ? nothing : html`
          <div class="message">${kMessages[status]}</div>
        `}
      </div>
    `;
  }

  #renderCursor(
    player: SoundPlayer
  ): TemplateResult | typeof nothing {
    const { duration } = player;
    if (player.playing || duration === null) {
      return nothing;
    }

    return html`
      <div
        class="playhead cursor"
        style=${styleMap({ left: `${player.position / duration * 100}%` })}
      ></div>
    `;
  }

  #renderPlayhead(
    playhead: PeerPlayhead
  ): TemplateResult {
    return html`
      <div
        class="playhead"
        style=${styleMap({
          left: `${playhead.position * 100}%`,
          background: playhead.color ?? undefined
        })}
      ></div>
    `;
  }

  #renderTags(
    position: number,
    tags: PlayheadTags
  ): TemplateResult | typeof nothing {
    if (tags.labels.length === 0) {
      return nothing;
    }

    return html`
      <div
        class=${tags.flipped ? "tags flipped" : "tags"}
        style=${styleMap({
          left: `${position * 100}%`,
          bottom: `${tags.row * PLAYHEAD_TAG_HEIGHT}px`,
          "--tag-width": `${PLAYHEAD_TAG_WIDTH}px`,
          "--tag-height": `${PLAYHEAD_TAG_HEIGHT}px`
        })}
      >
        ${tags.labels.map((label) => html`
          <span
            class="tag"
            style=${styleMap({ "--tag-color": label.color ?? undefined })}
          >${label.name}</span>
        `)}
      </div>
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
}

customElements.define("jolly-sound-wave", SoundWave);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-sound-wave": SoundWave;
  }
}
