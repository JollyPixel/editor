// Import Third-party Dependencies
import type {
  Preferences,
  PreferenceScope
} from "@jolly-pixel/preferences";
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import { PagePreferences } from "./PagePreferences.ts";

@customElement("studio-page-reset")
export class PageReset extends LitElement {
  @property()
  declare label: string;

  @property({ attribute: false })
  declare scopes: readonly PreferenceScope[];

  #preferences = new SubscriptionController<Preferences>(
    this,
    (preferences) => [
      preferences.subscribe(() => this.requestUpdate())
    ]
  );

  constructor() {
    super();
    this.label = "";
    this.scopes = [];
  }

  set preferences(
    preferences: Preferences | null
  ) {
    if (preferences !== null) {
      this.#preferences.attach(preferences);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const page = this.#page();
    if (page === null) {
      return nothing;
    }

    return html`
      <jolly-button
        data-action="reset-page"
        icon="revert"
        ?disabled=${!page.customized}
        @click=${this.#reset}
      >Reset page</jolly-button>
    `;
  }

  #page(): PagePreferences | null {
    const preferences = this.#preferences.current;

    return preferences === null ?
      null :
      new PagePreferences(preferences, this.scopes);
  }

  readonly #reset = async(): Promise<void> => {
    const confirmed = await showConfirm({
      title: `Reset ${this.label}?`,
      message: "Every preference and shortcut on this page goes back to its default.",
      confirmLabel: "Reset",
      danger: true
    });
    if (confirmed) {
      this.#page()?.reset();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-page-reset": PageReset;
  }
}
