// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  LogQueue,
  SubscriptionController
} from "@jolly-pixel/ui";
import type { HistoryStepInfo } from "@jolly-pixel/history";

// Import Internal Dependencies
import "./HistoryButtons.ts";
import { describeRefusal } from "./describeRefusal.ts";
import type { HistoryWorkspace } from "./HistoryButtons.ts";
import type { ModelAccessSignals } from "../../access/ModelAccess.ts";
import type { AnimationLibrary } from "../animation/index.ts";

// CONSTANTS
const kModelRefused = "You can only view this model, so the change was not saved";
const kSetRefused = "You can only view this animation set, so the change was not saved";

export interface HistoryBarWorkspace extends HistoryWorkspace {
  access: Pick<ModelAccessSignals, "subscribe">;
  animations: Pick<AnimationLibrary, "subscribe">;
}

export class HistoryBar extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    jolly-model-editor-history-buttons {
      position: absolute;
      bottom: var(--jolly-space-2, 8px);
      left: 50%;
      padding: var(--jolly-space-1, 4px);
      border-radius: 6px;
      background: var(--jolly-surface-raised, #2b2d31);
      pointer-events: auto;
      transform: translateX(-50%);
    }

    jolly-log {
      position: absolute;
      bottom: 44px;
      left: 50%;
      width: max-content;
      max-width: min(360px, calc(100% - 16px));
      transform: translateX(-50%);
    }
  `;

  #log = new LogQueue();
  #releaseLog: (() => void) | null = null;
  #workspace = new SubscriptionController<HistoryBarWorkspace>(
    this,
    ({ activeHistory, access, animations }) => {
      activeHistory.on("skipped", this.#onSkipped);

      return [
        () => activeHistory.off("skipped", this.#onSkipped),
        access.subscribe("denied", () => this.#log.push(kModelRefused)),
        animations.subscribe("setDenied", () => this.#log.push(kSetRefused))
      ];
    }
  );

  attach(
    workspace: HistoryBarWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#releaseLog = this.#log.subscribe(() => this.requestUpdate());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#releaseLog?.();
    this.#releaseLog = null;
  }

  readonly #onSkipped = (
    skipped: HistoryStepInfo
  ): void => {
    const step = skipped.label === null ? "a step" : `"${skipped.label}"`;
    const peers = this.#workspace.current?.presence.peers ?? [];
    this.#log.push(`Skipped ${step}: ${describeRefusal(skipped.refused, peers)}`);
  };

  override render(): TemplateResult {
    return html`
      <jolly-model-editor-history-buttons
        .workspace=${this.#workspace.current}
      ></jolly-model-editor-history-buttons>
      <jolly-log .entries=${this.#log.entries}></jolly-log>
    `;
  }
}

customElements.define("jolly-model-editor-history", HistoryBar);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-history": HistoryBar;
  }
}
