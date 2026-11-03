// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import type {
  ScriptOutline,
  ScriptOutlineFeed,
  ScriptPropertyValue
} from "@jolly-pixel/asset.script/client";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/property-row";

export class ScriptOutlinePane extends LitElement {
  #feed = new SubscriptionController<ScriptOutlineFeed>(this, (feed) => [
    feed.subscribe("change", () => this.requestUpdate())
  ]);

  static override styles = css`
    :host {
      display: block;
      color: var(--jolly-text);
    }

    .empty {
      padding: var(--jolly-space-3);
      color: var(--jolly-text-muted);
    }

    .type {
      color: var(--jolly-text-muted);
      font-family: ui-monospace, Consolas, monospace;
    }
  `;

  attach(
    feed: ScriptOutlineFeed
  ): void {
    this.#feed.attach(feed);
  }

  override render(): TemplateResult {
    const outline: ScriptOutline | null = this.#feed.current?.outline ?? null;
    if (outline === null || outline.behaviors.length === 0) {
      return html`<p class="empty">No behavior found in this script.</p>`;
    }

    return html`${outline.behaviors.map((behavior) => html`
      <jolly-folder
        key=${behavior.name}
        label=${behavior.name}
        flush
      >
        ${behavior.properties.length === 0 ?
          html`<p class="empty">No scene property.</p>` :
          behavior.properties.map((property) => html`
            <jolly-property-row label=${property.label} align="end">
              <span class="type">${property.type}${defaultText(property.default)}</span>
            </jolly-property-row>
          `)}
      </jolly-folder>
    `)}`;
  }
}

function defaultText(
  value: ScriptPropertyValue | null
): string {
  return value === null ? "" : ` = ${JSON.stringify(value)}`;
}

customElements.define("jolly-script-outline", ScriptOutlinePane);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-script-outline": ScriptOutlinePane;
  }
}
