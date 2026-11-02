// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/property-row";

// Import Internal Dependencies
import type { SoundPlayer } from "../../player/SoundPlayer.ts";

// CONSTANTS
const kUnknown = "-";

export class SoundDetails extends LitElement {
  #player = new SubscriptionController<SoundPlayer>(this, (player) => [
    player.subscribe("sound", () => this.requestUpdate())
  ]);

  static override styles = css`
    :host {
      display: block;
      color: var(--jolly-text);
    }

    .value {
      font-variant-numeric: var(--jolly-font-numeric);
    }
  `;

  attach(
    player: SoundPlayer
  ): void {
    this.#player.attach(player);
  }

  override render(): TemplateResult {
    const format = this.#player.current?.format() ?? null;

    return html`
      <jolly-folder
        key="details"
        label="Details"
        storage-key="sound:folder:details"
        flush
      >
        <jolly-property-row label="Sample rate" align="end">
          <span class="value">${format?.sampleRate ?? kUnknown}</span>
        </jolly-property-row>
        <jolly-property-row label="Channels" align="end">
          <span>${format?.channels ?? kUnknown}</span>
        </jolly-property-row>
      </jolly-folder>
    `;
  }
}

customElements.define("jolly-sound-details", SoundDetails);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-sound-details": SoundDetails;
  }
}
