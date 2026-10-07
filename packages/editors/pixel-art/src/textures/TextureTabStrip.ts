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

// Import Internal Dependencies
import type { TextureSet } from "./TextureSet.ts";

export type TextureTabsMode = "auto" | "always";

export type TextureChangeSource = "user" | "api";

export interface TextureChangeDetail {
  id: string;
  source: TextureChangeSource;
}

export interface TextureCloseRequestDetail {
  id: string;
}

export interface TextureEditRequestDetail {
  id: string;
}

export interface TextureTabStripHost extends ReactiveControllerHost, HTMLElement {
  readonly textureTabs: TextureTabsMode;
  readonly textureTabsVariant: TabsVariant;
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

  activate(
    id: string,
    source: TextureChangeSource
  ): void {
    const entry = this.#textures.get(id);
    if (entry !== this.#textures.active) {
      this.#textures.activate(entry);
      this.emitChange(entry.id, source);
    }
  }

  emitChange(
    id: string,
    source: TextureChangeSource
  ): void {
    this.#host.dispatchEvent(new CustomEvent<TextureChangeDetail>("texture-change", {
      bubbles: true,
      composed: true,
      detail: {
        id,
        source
      }
    }));
  }

  render(): TemplateResult | typeof nothing {
    const host = this.#host;
    if (host.textureTabs === "auto" && this.#textures.size < 2) {
      return nothing;
    }

    return html`
      <jolly-tabs
        class="texture-tabs"
        part="texture-tabs"
        .variant=${host.textureTabsVariant}
        .value=${this.#textures.active?.id ?? ""}
        @jolly-tab-change=${(event: CustomEvent<JollyTabChangeDetail>) => {
          event.stopPropagation();
          this.activate(event.detail.value, "user");
        }}
        @jolly-tab-close=${(event: CustomEvent<JollyTabChangeDetail>) => {
          this.#forward("texture-close-request", event);
        }}
        @jolly-tab-action=${(event: CustomEvent<JollyTabChangeDetail>) => {
          this.#forward("texture-edit-request", event);
        }}
      >
        ${repeat(
          this.#textures,
          (entry) => entry.id,
          (entry) => html`
            <jolly-tab
              .value=${entry.id}
              .label=${entry.name}
              .tooltip=${entry.tooltip}
              .badge=${entry.badge}
              .action=${host.texturesEditable ? "edit" : ""}
              .actionLabel=${"Edit"}
              ?disabled=${entry.disabled}
              ?closable=${host.texturesClosable}
            ></jolly-tab>
          `
        )}
        ${host.texturesAddable ?
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

  #forward(
    type: "texture-close-request" | "texture-edit-request",
    event: CustomEvent<JollyTabChangeDetail>
  ): void {
    event.stopPropagation();
    this.#host.dispatchEvent(new CustomEvent<TextureCloseRequestDetail>(type, {
      bubbles: true,
      composed: true,
      detail: { id: event.detail.value }
    }));
  }

  #requestCreate(): void {
    this.#host.dispatchEvent(new CustomEvent("texture-create-request", {
      bubbles: true,
      composed: true
    }));
  }
}
