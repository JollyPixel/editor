// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
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
import { refusalWording } from "./refusalWording.ts";
import type { ActiveHistory } from "./ActiveHistory.ts";
import type { PresenceStore } from "../../state/index.ts";
import type { ModelAccessSignals } from "../../access/ModelAccess.ts";
import type { AnimationLibrary } from "../animation/index.ts";

// CONSTANTS
const kModelRefused = "You can only view this model, so the change was not saved";
const kSetRefused = "You can only view this animation set, so the change was not saved";

export interface HistoryLogEditing {
  activeHistory: ActiveHistory;
  presence: PresenceStore;
  access: Pick<ModelAccessSignals, "subscribe">;
  animations: Pick<AnimationLibrary, "subscribe">;
}

export class HistoryLog extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    jolly-log {
      width: max-content;
      max-width: 360px;
    }
  `;

  static override properties = {
    editing: { attribute: false }
  };

  declare editing: HistoryLogEditing | null;

  #log = new LogQueue();
  #releaseLog: (() => void) | null = null;
  #editing = new SubscriptionController<HistoryLogEditing>(
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

  constructor() {
    super();
    this.editing = null;
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("editing") && this.editing !== null) {
      this.#editing.attach(this.editing);
    }
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
    return html`<jolly-log .entries=${this.#log.entries}></jolly-log>`;
  }
}

customElements.define("jolly-model-editor-history-log", HistoryLog);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-history-log": HistoryLog;
  }
}
