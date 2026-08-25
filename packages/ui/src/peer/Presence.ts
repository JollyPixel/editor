// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement
} from "lit/decorators.js";

// Import Internal Dependencies
import { presenceStyles } from "./Presence.styles.ts";
import type { CollaboratorPresence } from "./types.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

export interface PresencePeer extends CollaboratorPresence {
  /** Marks the local peer. At most one entry should set this. */
  self?: boolean;
}

/**
 * A read-only view of a collaboration snapshot.
 *
 * The host owns transport, identity, names, and colors. Assigning peers
 * copies the iterable so later collection mutations do not change this view.
 */
@customElement("jolly-presence")
export class PresenceElement extends LitElement {
  static override properties = {
    peers: {
      attribute: false
    },
    max: {
      type: Number
    }
  };

  static override styles = [
    presenceStyles,
    hiddenStyles
  ];

  #peers: PresencePeer[] = [];
  #max = Infinity;

  get peers(): ReadonlyArray<PresencePeer> {
    return [...this.#peers];
  }

  set peers(
    value: Iterable<PresencePeer>
  ) {
    const previous = this.#peers;
    this.#peers = [...value];
    this.requestUpdate("peers", previous);
  }

  /**
   * Maximum number of named peers to show. Infinity leaves the list uncapped.
   * Finite values floor and clamp at zero.
   */
  get max(): number {
    return this.#max;
  }

  set max(
    value: number
  ) {
    const next = normalizeMax(value);
    if (next === this.#max) {
      return;
    }

    const previous = this.#max;
    this.#max = next;
    this.requestUpdate("max", previous);
  }

  override render(): TemplateResult {
    const visiblePeers = this.#visiblePeers();
    const overflow = this.#peers.length - visiblePeers.length;

    return html`
      <div class="summary" part="summary" aria-live="polite">
        ${formatConnectionCount(this.#peers.length)}
      </div>
      <ul class="list" part="list">
        ${visiblePeers.map((peer) => html`
          <li class="peer" part="peer">
            <span
              class="swatch"
              part="swatch"
              role="img"
              aria-label=${`${peer.displayName}'s color`}
              style=${`background-color: ${peer.color}`}
            ></span>
            <span class=${peer.self ? "self" : ""}>
              ${peer.displayName}${peer.self ? " (you)" : ""}
            </span>
          </li>
        `)}
        ${overflow > 0
          ? html`
            <li class="overflow" part="overflow">+${overflow} more</li>
          `
          : ""}
      </ul>
    `;
  }

  #visiblePeers(): PresencePeer[] {
    if (this.#max === Infinity || this.#peers.length <= this.#max) {
      return this.#peers;
    }
    if (this.#max === 0) {
      return [];
    }

    const visible = this.#peers.slice(0, this.#max);
    const selfIndex = this.#peers.findIndex((peer) => peer.self);
    if (selfIndex >= this.#max) {
      visible[visible.length - 1] = this.#peers[selfIndex];
    }

    return visible;
  }
}

function normalizeMax(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return Infinity;
  }

  return Math.max(0, Math.floor(value));
}

function formatConnectionCount(
  count: number
): string {
  return count === 1 ?
    "1 person connected" :
    `${count} people connected`;
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-presence": PresenceElement;
  }
}
