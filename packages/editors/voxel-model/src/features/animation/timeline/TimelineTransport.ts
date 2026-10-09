// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import {
  FrameRate,
  TICKS_PER_SECOND
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import "./timelineIcons.ts";
import type { AnimationSession } from "../session/AnimationSession.ts";

export interface TimelineTransportWorkspace {
  animationSession: AnimationSession;
}

export class TimelineTransport extends LitElement {
  static override styles = css`
    .transport {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2, 8px);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .muted {
      opacity: 0.75;
    }

    jolly-tool-button {
      --jolly-tool-button-size: var(--jolly-icon-button-size, 32px);
    }

    .clip {
      max-width: 160px;
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
    }
  `;

  #connection = new SubscriptionController<TimelineTransportWorkspace>(this, ({ animationSession }) => [
    animationSession.subscribe("clip", this.#refresh),
    animationSession.subscribe("playhead", this.#refresh)
  ]);

  attach(
    workspace: TimelineTransportWorkspace
  ): void {
    this.#connection.attach(workspace);
  }

  override render(): TemplateResult | typeof nothing {
    const session = this.#connection.current?.animationSession;
    const clip = session?.focused?.clip;
    if (session === undefined || clip === undefined) {
      return nothing;
    }

    const { tick, playing, loop } = session.playback;
    const label = playing ? "Pause" : "Play";
    const rate = new FrameRate(clip.fps);

    return html`
      <div class="transport" role="toolbar" aria-label="Playback">
        <span class="clip" title="Clip">${clip.name}</span>
        <jolly-button
          icon=${playing ? "timeline-pause" : "timeline-play"}
          icon-only
          label=${label}
          title=${`${label} (Space)`}
          @click=${this.#onToggle}
        ></jolly-button>
        <jolly-tool-button
          icon="timeline-loop"
          label="Loop preview"
          ?active=${loop}
          @click=${this.#onToggleLoop}
        ></jolly-tool-button>
        <span aria-label="Playhead">
          Frame ${rate.frameAt(tick)} / ${rate.frameAt(clip.length)}
          <span class="muted">· ${(tick / TICKS_PER_SECOND).toFixed(2)}s</span>
        </span>
        <span class="muted">· ${clip.fps} fps</span>
      </div>
    `;
  }

  readonly #refresh = (): void => {
    this.requestUpdate();
  };

  readonly #onToggle = (): void => {
    this.#connection.current?.animationSession.togglePlay();
  };

  readonly #onToggleLoop = (): void => {
    this.#connection.current?.animationSession.toggleLoop();
  };
}

customElements.define("jolly-model-editor-timeline-transport", TimelineTransport);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-timeline-transport": TimelineTransport;
  }
}
