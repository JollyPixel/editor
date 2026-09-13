// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { detailOf } from "../../dom.ts";
import { defaultStorageAdapter } from "../../storage/defaultStorage.ts";
import { NamespacedStore } from "../../storage/NamespacedStore.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";
import type { JollyChangeDetail } from "../../field/events.ts";
import type {
  Density,
  ThemeMode
} from "../types.ts";
import {
  applyAppearance,
  resolveDensityPreference,
  resolveThemePreference
} from "../preferences.ts";

// Registers the composed controls.
import "./DensityControl.ts";
import "./ThemeControl.ts";

export type ThemePreferencesLayout = "inline" | "stack";

@customElement("jolly-theme-preferences")
export class ThemePreferences extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    :host([layout="stack"]) {
      display: grid;
      gap: var(--jolly-row-gap, 4px);
    }
  `;

  @property({
    type: String,
    reflect: true
  })
  declare layout: ThemePreferencesLayout;

  @property({ attribute: false })
  declare target: HTMLElement | null;

  @property({
    type: String,
    attribute: "storage-key"
  })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @property({ attribute: false })
  declare defaultTheme: ThemeMode;

  @property({ attribute: false })
  declare defaultDensity: Density;

  #store = new NamespacedStore({
    namespace: () => this.storageKey,
    storage: () => this.storage
  });

  constructor() {
    super();

    this.layout = "inline";
    this.target = null;
    this.storageKey = "";
    this.storage = defaultStorageAdapter();
    this.defaultTheme = "auto";
    this.defaultDensity = "default";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#applyPreferences();
  }

  protected override updated(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (changed.has("target")) {
      this.#applyPreferences();
    }
  }

  override render(): TemplateResult {
    return html`
      <jolly-theme-control
        .value=${this.#theme()}
        @jolly-change=${this.#onThemeChange}
      ></jolly-theme-control>
      <jolly-density-control
        .value=${this.#density()}
        @jolly-change=${this.#onDensityChange}
      ></jolly-density-control>
    `;
  }

  #applyPreferences(): void {
    const target = this.#target();
    if (target === null) {
      return;
    }

    applyAppearance(
      target,
      this.#theme(),
      this.#density()
    );
  }

  #target(): HTMLElement | null {
    return this.target ?? this.closest("jolly-scope");
  }

  #theme(): ThemeMode {
    const value = this.#store.read("theme");

    return resolveThemePreference(
      value,
      this.defaultTheme
    );
  }

  #density(): Density {
    const value = this.#store.read("density");

    return resolveDensityPreference(
      value,
      this.defaultDensity
    );
  }

  #onThemeChange = (
    event: Event
  ) => {
    const detail = detailOf<JollyChangeDetail<ThemeMode>>(event);
    if (detail === null) {
      return;
    }

    this.#store.write("theme", detail.value);
    this.#applyPreferences();
  };

  #onDensityChange = (
    event: Event
  ) => {
    const detail = detailOf<JollyChangeDetail<Density>>(event);
    if (detail === null) {
      return;
    }

    this.#store.write("density", detail.value);
    this.#applyPreferences();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-theme-preferences": ThemePreferences;
  }
}
