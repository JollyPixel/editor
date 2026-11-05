// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
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
import { notificationsStyles } from "./Notifications.styles.ts";
import type { NotificationQueue } from "./NotificationQueue.ts";
import type {
  NotificationEntry,
  NotificationPlacement,
  NotificationTone
} from "./NotificationQueue.types.ts";
import { SubscriptionController } from "../reactive/SubscriptionController.ts";
import "../icon/Icon.ts";
import "./Spinner.ts";
import "./Progress.ts";

// CONSTANTS
const kToneIcons: Readonly<Record<Exclude<NotificationTone, "loading">, string>> = {
  success: "check",
  info: "info",
  warning: "warning",
  error: "error"
};

@customElement("jolly-notifications")
export class Notifications extends LitElement {
  static override styles = notificationsStyles;

  @property({ type: String, reflect: true })
  declare placement: NotificationPlacement;

  @property({ type: String })
  declare label: string;

  #queue = new SubscriptionController<NotificationQueue>(
    this,
    (queue) => [
      queue.subscribe((entries) => this.#entries.reconcile(entries))
    ]
  );
  #entries = new LeavingEntries<NotificationEntry>(this);

  constructor() {
    super();
    this.placement = "bottom-end";
    this.label = "Notifications";
    this.addEventListener("pointerenter", () => this.#queue.current?.pause());
    this.addEventListener("pointerleave", () => this.#queue.current?.resume());
    this.addEventListener("focusin", () => this.#queue.current?.pause());
    this.addEventListener("focusout", (event) => {
      if (!this.contains(event.relatedTarget as Node | null)) {
        this.#queue.current?.resume();
      }
    });
  }

  attach(
    queue: NotificationQueue
  ): void {
    this.#queue.attach(queue);
    this.#entries.reconcile(queue.entries);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "region");
    this.setAttribute("popover", "manual");
    if (typeof this.showPopover === "function") {
      this.showPopover();
    }
  }

  protected override willUpdate(): void {
    this.setAttribute("aria-label", this.label);
    this.toggleAttribute("empty", this.#entries.rendered.length === 0);
  }

  protected override render(): TemplateResult {
    return html`${repeat(
      this.#entries.rendered,
      (entry) => entry.id,
      (entry) => this.#row(entry)
    )}`;
  }

  #row(
    entry: NotificationEntry
  ): TemplateResult {
    const leaving = this.#entries.isLeaving(entry.id);
    const urgent = entry.tone === "error" || entry.tone === "warning";

    return html`
      <div
        class=${classMap({ row: true, leaving })}
        aria-hidden=${leaving ? "true" : "false"}
        @transitionend=${(event: TransitionEvent) => {
          this.#entries.settle(event, entry.id);
        }}
      >
        <div class="slot"><div
          class="chip"
          part="chip"
          data-tone=${entry.tone}
          role=${urgent ? "alert" : "status"}
        >
          <span class="mark">${this.#mark(entry.tone)}</span>
          <div class="text">
            ${entry.source === "" ?
              nothing :
              html`<span class="source">${entry.source}</span>`}
            <span class="title">${entry.title}</span>
            ${entry.message === "" ?
              nothing :
              html`<span class="message">${entry.message}</span>`}
            ${entry.progress === null ?
              nothing :
              html`<jolly-progress
                .value=${entry.progress}
                label=${entry.title}
              ></jolly-progress>`}
          </div>
          <button
            class="close"
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
            ?disabled=${leaving}
            @click=${() => this.#queue.current?.dismiss(entry.id)}
          ><jolly-icon name="close" aria-hidden="true"></jolly-icon></button>
        </div></div>
      </div>
    `;
  }

  #mark(
    tone: NotificationTone
  ): TemplateResult {
    return tone === "loading" ?
      html`<jolly-spinner></jolly-spinner>` :
      html`<jolly-icon name=${kToneIcons[tone]}></jolly-icon>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-notifications": Notifications;
  }
}
