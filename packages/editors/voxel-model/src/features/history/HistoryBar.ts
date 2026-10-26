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
import "@jolly-pixel/ui/elements/log";
import {
  describeSkippedStep,
  type HistoryStepInfo
} from "@jolly-pixel/history";

// Import Internal Dependencies
import "./HistoryButtons.ts";
import { refusalWording } from "./refusalWording.ts";
import type { HistoryEditing } from "./HistoryButtons.ts";
import type { ModelAccessSignals } from "../../access/ModelAccess.ts";
import type { AnimationLibrary } from "../animation/index.ts";

// CONSTANTS
const kModelRefused = "You can only view this model, so the change was not saved";
const kSetRefused = "You can only view this animation set, so the change was not saved";

export interface HistoryBarEditing extends HistoryEditing {
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
  #editing = new SubscriptionController<HistoryBarEditing>(
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
    editing: HistoryBarEditing
  ): void {
    this.#editing.attach(editing);
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
    const peers = this.#editing.current?.presence.peers ?? [];
    this.#log.push(describeSkippedStep(skipped, refusalWording(peers)));
  };

  override render(): TemplateResult {
    return html`
      <jolly-model-editor-history-buttons
        .editing=${this.#editing.current}
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
