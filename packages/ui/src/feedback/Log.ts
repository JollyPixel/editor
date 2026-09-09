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
import { logStyles } from "./Log.styles.ts";
import type { LogEntry } from "./LogQueue.types.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

// CONSTANTS
const kExitFallbackMs = 1_000;

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

  #rendered: readonly LogEntry[] = [];
  #leaving = new Set<string>();
  #timers = new Map<string, number>();

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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const timer of this.#timers.values()) {
      window.clearTimeout(timer);
    }
    this.#timers.clear();
  }

  protected override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("live")) {
      this.setAttribute("aria-live", this.live);
    }
    if (changedProperties.has("entries")) {
      this.#reconcile(this.entries ?? []);
    }
    this.empty = this.#rendered.length === 0;
  }

  protected override render(): TemplateResult {
    return html`${repeat(
      this.#rendered,
      (entry) => entry.id,
      (entry) => this.#row(entry)
    )}`;
  }

  #row(
    entry: LogEntry
  ): TemplateResult {
    const leaving = this.#leaving.has(entry.id);

    return html`
      <div
        class=${classMap({ row: true, leaving })}
        aria-hidden=${leaving ? "true" : "false"}
        @transitionend=${() => this.#drop(entry.id)}
      >
        <div class="content">${entry.content}</div>
      </div>
    `;
  }

  #reconcile(
    incoming: readonly LogEntry[]
  ): void {
    const byId = new Map(
      incoming.map((entry) => [entry.id, entry])
    );
    const known = new Set(
      this.#rendered.map((entry) => entry.id)
    );

    for (const entry of this.#rendered) {
      if (!byId.has(entry.id)) {
        this.#markLeaving(entry.id);
      }
    }

    const added = incoming.filter(
      (entry) => !known.has(entry.id)
    );
    const kept = this.#rendered
      .filter((entry) => byId.has(entry.id) || this.#leaving.has(entry.id))
      .map((entry) => byId.get(entry.id) ?? entry);

    this.#rendered = [
      ...added,
      ...kept
    ];
  }

  #markLeaving(
    id: string
  ): void {
    if (this.#leaving.has(id)) {
      return;
    }

    this.#leaving.add(id);
    this.#timers.set(id, window.setTimeout(
      () => this.#drop(id),
      kExitFallbackMs
    ));
  }

  #drop(
    id: string
  ): void {
    if (!this.#leaving.delete(id)) {
      return;
    }

    const timer = this.#timers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.#timers.delete(id);
    }
    this.#rendered = this.#rendered.filter(
      (entry) => entry.id !== id
    );
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-log": LogElement;
  }
}
