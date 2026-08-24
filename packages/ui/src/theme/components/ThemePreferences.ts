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
import {
  LocalStorageAdapter
} from "../../storage/LocalStorageAdapter.ts";
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

// CONSTANTS
const kThemeSuffix = ":theme";
const kDensitySuffix = ":density";

export type ThemePreferencesLayout = "inline" | "stack";

/**
 * Persists and applies a theme and density pair to a scope host.
 */
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

  constructor() {
    super();

    this.layout = "inline";
    this.target = null;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
    this.defaultTheme = "auto";
    this.defaultDensity = "default";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#applyPreferences();
  }

  /**
   * A consumer sets `target` imperatively when it lives outside this
   * element's own tree (so `.closest("jolly-scope")` can't find it) — most
   * often after both elements exist, which is later than `connectedCallback`.
   */
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

    applyAppearance(target, this.#theme(), this.#density());
  }

  #target(): HTMLElement | null {
    return this.target ?? this.closest("jolly-scope");
  }

  #theme(): ThemeMode {
    const value = this.#stored(kThemeSuffix);

    return resolveThemePreference(value, this.defaultTheme);
  }

  #density(): Density {
    const value = this.#stored(kDensitySuffix);

    return resolveDensityPreference(value, this.defaultDensity);
  }

  #stored(
    suffix: string
  ): string | null {
    return this.storageKey === "" ? null :
      this.storage.get(`${this.storageKey}${suffix}`);
  }

  #onThemeChange = (
    event: Event
  ) => {
    const detail = detailOf<JollyChangeDetail<ThemeMode>>(event);
    if (detail === null) {
      return;
    }

    this.#store(
      kThemeSuffix,
      detail.value
    );
    this.#applyPreferences();
  };

  #onDensityChange = (
    event: Event
  ) => {
    const detail = detailOf<JollyChangeDetail<Density>>(event);
    if (detail === null) {
      return;
    }

    this.#store(
      kDensitySuffix,
      detail.value
    );
    this.#applyPreferences();
  };

  #store(
    suffix: string,
    value: string
  ): void {
    if (this.storageKey !== "") {
      this.storage.set(
        `${this.storageKey}${suffix}`,
        value
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-theme-preferences": ThemePreferences;
  }
}
