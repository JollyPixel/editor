// Import Third-party Dependencies
import {
  LitElement,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { LeavingEntries } from "./LeavingEntries.ts";
import { logStyles } from "./Log.styles.ts";
import type { LogEntry } from "./LogQueue.types.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

export type LogLiveness = "polite" | "off";

@customElement("jolly-log")
export class LogElement extends LitElement {
  static override styles = [
    logStyles,
    hiddenStyles
  ];

  @property({ attribute: false })
  declare entries: readonly LogEntry[];

  @property({ type: String, reflect: true })
  declare live: LogLiveness;

  @property({ type: Boolean, reflect: true })
  declare empty: boolean;

  #entries = new LeavingEntries<LogEntry>(this);

  constructor() {
    super();
    this.entries = [];
    this.live = "polite";
    this.empty = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "log");
    this.setAttribute("aria-relevant", "additions");
    this.setAttribute("aria-atomic", "false");
    this.setAttribute("aria-live", this.live);
  }

  protected override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("live")) {
      this.setAttribute("aria-live", this.live);
    }
    if (changedProperties.has("entries")) {
      this.#entries.reconcile(this.entries ?? []);
    }
    this.empty = this.#entries.rendered.length === 0;
  }

  protected override render(): TemplateResult {
    return html`${repeat(
      this.#entries.rendered,
      (entry) => entry.id,
      (entry) => this.#row(entry)
    )}`;
  }

  #row(
    entry: LogEntry
  ): TemplateResult {
    const leaving = this.#entries.isLeaving(entry.id);

    return html`
      <div
        class=${classMap({ row: true, leaving })}
        aria-hidden=${leaving ? "true" : "false"}
        @transitionend=${(event: TransitionEvent) => {
          this.#entries.settle(event, entry.id);
        }}
      >
        <div class="content">${entry.content}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-log": LogElement;
  }
}
