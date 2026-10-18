// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import {
  customElement
} from "lit/decorators.js";

// Import Internal Dependencies
import { presenceStackStyles } from "./PresenceStack.styles.ts";
import { PeerListElement } from "./PeerListElement.ts";
import { preventDefault } from "../dom.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";
import type { PresencePeer } from "./types.ts";

@customElement("jolly-presence-stack")
export class PresenceStack extends PeerListElement {
  static override styles = [
    presenceStackStyles,
    hiddenStyles
  ];

  override render(): TemplateResult {
    const { visible, hidden } = this.partition();

    return html`
      <ul
        class="stack"
        part="stack"
        aria-label=${this.connectionLabel}
      >
        ${visible.map((peer) => this.#renderPeer(peer))}
        ${hidden.length > 0 ? this.#renderOverflow(hidden) : ""}
      </ul>
    `;
  }

  #renderPeer(
    peer: PresencePeer
  ): TemplateResult {
    const name = peerName(peer);
    const body = html`
      ${this.renderAvatar(peer)}
      <span class="tooltip" part="tooltip" aria-hidden="true">
        <span class="line">${name}${peer.badge === undefined ? "" : html`
          <span class="badge">${peer.badge}</span>
        `}</span>
      </span>
    `;

    const color = `--jolly-peer-color: ${peer.color}`;

    if (!this.isSelectable(peer)) {
      return html`
        <li class="peer" part="peer">
          <span
            class="chip"
            role="img"
            aria-label=${name}
            style=${color}
          >${body}</span>
        </li>
      `;
    }

    return html`
      <li class="peer" part="peer">
        <button
          class="chip"
          part="peer-button"
          type="button"
          style=${color}
          aria-label=${`Select ${peer.displayName}`}
          @mousedown=${preventDefault}
          @click=${() => this.select(peer)}
        >${body}</button>
      </li>
    `;
  }

  #renderOverflow(
    hiddenPeers: readonly PresencePeer[]
  ): TemplateResult {
    const names = hiddenPeers.map(peerName);

    return html`
      <li class="peer" part="overflow">
        <span
          class="chip more"
          role="img"
          tabindex="0"
          aria-label=${`${hiddenPeers.length} more: ${names.join(", ")}`}
        >
          +${hiddenPeers.length}
          <span class="tooltip" part="tooltip" aria-hidden="true">
            ${names.map((name) => html`<span class="line">${name}</span>`)}
          </span>
        </span>
      </li>
    `;
  }
}

function peerName(
  peer: PresencePeer
): string {
  return peer.self ? `${peer.displayName} (you)` : peer.displayName;
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-presence-stack": PresenceStack;
  }
}
