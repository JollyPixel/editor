// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import {
  customElement
} from "lit/decorators.js";

// Import Internal Dependencies
import { presenceStyles } from "./Presence.styles.ts";
import { PeerListElement } from "./PeerListElement.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";
import type { PresencePeer } from "./types.ts";

/**
 * A read-only view of a collaboration snapshot.
 */
@customElement("jolly-presence")
export class PresenceElement extends PeerListElement {
  static override styles = [
    presenceStyles,
    hiddenStyles
  ];

  override render(): TemplateResult {
    const { visible, hidden } = this.partition();

    return html`
      <div class="summary" part="summary" aria-live="polite">
        ${this.connectionLabel}
      </div>
      <ul class="list" part="list">
        ${visible.map((peer) => this.#renderPeer(peer))}
        ${hidden.length > 0
          ? html`
            <li class="overflow" part="overflow">+${hidden.length} more</li>
          `
          : ""}
      </ul>
    `;
  }

  #renderPeer(
    peer: PresencePeer
  ): TemplateResult {
    const body = html`
      ${this.renderAvatar(peer)}
      <span class=${peer.self ? "self" : ""}>
        ${peer.displayName}${peer.self ? " (you)" : ""}
      </span>
      ${peer.badge === undefined ? "" : html`
        <span class="badge" part="badge">${peer.badge}</span>
      `}
    `;

    if (!this.isSelectable(peer)) {
      return html`
        <li class="peer" part="peer">${body}</li>
      `;
    }

    return html`
      <li class="peer" part="peer">
        <button
          class="select"
          part="peer-button"
          type="button"
          aria-label=${`Select ${peer.displayName}`}
          @click=${() => this.select(peer)}
        >${body}</button>
      </li>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-presence": PresenceElement;
  }
}
