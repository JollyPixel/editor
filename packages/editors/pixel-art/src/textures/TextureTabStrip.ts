// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import { repeat } from "lit/directives/repeat.js";
import type {
  JollyTabChangeDetail,
  TabsVariant
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/tab";
import "@jolly-pixel/ui/elements/tabs";

// Import Internal Dependencies
import type { TextureEntry } from "./TextureEntry.ts";
import type { TextureSet } from "./TextureSet.ts";
import { renderIcon } from "../shared/icons.ts";

// CONSTANTS
const kEditHint = "Double-click or F2 to edit";
const kLineToggleLabel = "Line texture tabs";

export type TextureTabsMode = "auto" | "always";

export type TextureTabsVariant = Exclude<TabsVariant, "line">;

export interface TextureCloseRequestDetail {
  id: string;
}

export interface TextureEditRequestDetail {
  id: string;
}

export interface TextureTabStripHost extends ReactiveControllerHost, HTMLElement {
  readonly textureTabs: TextureTabsMode;
  readonly textureTabsVariant: TextureTabsVariant;
  textureTabsLine: boolean;
  readonly texturesClosable: boolean;
  readonly texturesAddable: boolean;
  readonly texturesEditable: boolean;
  readonly textureAddLabel: string;
}

export class TextureTabStrip {
  readonly #host: TextureTabStripHost;
  readonly #textures: TextureSet;

  constructor(
    host: TextureTabStripHost,
    textures: TextureSet
  ) {
    this.#host = host;
    this.#textures = textures;
  }

  get #visible(): boolean {
    return this.#host.textureTabs === "always" || this.#textures.size > 1;
  }

  render(): TemplateResult | typeof nothing {
    if (!this.#visible) {
      return nothing;
    }

    const host = this.#host;
    const line = host.textureTabsLine;

    return html`
      <jolly-tabs
        class="texture-tabs"
        part="texture-tabs"
        .variant=${line ? "line" : host.textureTabsVariant}
        .value=${this.#textures.active?.id ?? ""}
        @jolly-tab-change=${(event: CustomEvent<JollyTabChangeDetail>) => {
          event.stopPropagation();
          this.#textures.activate(event.detail.value, "user");
        }}
        @jolly-tab-close=${(event: CustomEvent<JollyTabChangeDetail>) => {
          event.stopPropagation();
          this.#request("texture-close-request", event.detail.value);
        }}
        @jolly-tab-edit=${(event: CustomEvent<JollyTabChangeDetail>) => {
          event.stopPropagation();
          if (host.texturesEditable) {
            this.#request("texture-edit-request", event.detail.value);
          }
        }}
      >
        ${repeat(
          this.#textures,
          (entry) => entry.id,
          (entry) => html`
            <jolly-tab
              .value=${entry.id}
              .label=${entry.name}
              .tooltip=${this.#tooltip(entry)}
              ?disabled=${entry.disabled}
              ?closable=${host.texturesClosable}
            ></jolly-tab>
          `
        )}
        ${host.texturesAddable && !line ?
          html`
            <jolly-button
              slot="list-end"
              class="texture-add"
              part="texture-add"
              icon="add"
              icon-only
              label=${host.textureAddLabel}
              title=${host.textureAddLabel}
              @click=${() => this.#requestCreate()}
            ></jolly-button>
          ` :
          nothing}
      </jolly-tabs>
    `;
  }

  renderLineToggle(): TemplateResult | typeof nothing {
    if (!this.#visible) {
      return nothing;
    }

    return html`
      <button
        class="rail-btn line-tabs-toggle"
        part="line-tabs-toggle"
        title=${kLineToggleLabel}
        aria-label=${kLineToggleLabel}
        aria-pressed=${this.#host.textureTabsLine ? "true" : "false"}
        @click=${() => this.#toggleLine()}
      >${renderIcon("lineTabs")}</button>
    `;
  }

  #toggleLine(): void {
    const host = this.#host;
    host.textureTabsLine = !host.textureTabsLine;
    host.dispatchEvent(new CustomEvent<boolean>("texture-tabs-line-change", {
      bubbles: true,
      composed: true,
      detail: host.textureTabsLine
    }));
  }

  #tooltip(
    entry: TextureEntry
  ): string {
    if (!this.#host.texturesEditable) {
      return entry.tooltip;
    }

    return entry.tooltip === "" ? kEditHint : `${entry.tooltip}\n${kEditHint}`;
  }

  #request(
    type: "texture-close-request" | "texture-edit-request",
    id: string
  ): void {
    this.#host.dispatchEvent(new CustomEvent<TextureCloseRequestDetail>(type, {
      bubbles: true,
      composed: true,
      detail: { id }
    }));
  }

  #requestCreate(): void {
    this.#host.dispatchEvent(new CustomEvent("texture-create-request", {
      bubbles: true,
      composed: true
    }));
  }
}
