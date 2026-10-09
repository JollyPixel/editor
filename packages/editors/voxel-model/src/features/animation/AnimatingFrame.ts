// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import { FrameRate } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { AnimationSession } from "./session/AnimationSession.ts";

export interface AnimatingFrameWorkspace {
  animationSession: AnimationSession;
}

export class AnimatingFrame extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .frame {
      position: absolute;
      inset: 0;
      border: 2px solid var(--jolly-danger, #e5484d);
    }

    .label {
      position: absolute;
      top: var(--jolly-space-2, 8px);
      left: 50%;
      padding: 2px var(--jolly-space-2, 8px);
      border-radius: var(--jolly-radius, 4px);
      background: var(--jolly-danger, #e5484d);
      color: white;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      transform: translateX(-50%);
    }
  `;

  static override properties = {
    _label: { state: true }
  };

  declare private _label: string | null;

  #workspace = new SubscriptionController<AnimatingFrameWorkspace>(
    this,
    ({ animationSession }) => {
      const update = (): void => {
        this._label = animatingLabel(animationSession);
      };
      update();

      return [
        animationSession.subscribe("clip", update),
        animationSession.subscribe("playhead", update)
      ];
    }
  );

  constructor() {
    super();
    this._label = null;
  }

  attach(
    workspace: AnimatingFrameWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  override render(): TemplateResult | typeof nothing {
    if (this._label === null) {
      return nothing;
    }

    return html`
      <div class="frame"></div>
      <span class="label" role="status">${this._label}</span>
    `;
  }
}

function animatingLabel(
  session: AnimationSession
): string | null {
  if (!session.active) {
    return null;
  }

  const clip = session.focused?.clip;

  return clip === undefined ?
    "Animating: no clip" :
    `Animating: ${clip.name} · frame ${new FrameRate(clip.fps).frameAt(session.playback.tick)}`;
}

customElements.define("jolly-model-editor-animating-frame", AnimatingFrame);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-animating-frame": AnimatingFrame;
  }
}
