// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import { emitPeerEvent } from "./events.ts";
import {
  normalizePeerMax,
  partitionPeers,
  type PeerPartition
} from "./peerOrder.ts";
import type { PresencePeer } from "./types.ts";
import "./Avatar.ts";

export abstract class PeerListElement extends LitElement {
  static override properties = {
    peers: {
      attribute: false
    },
    max: {
      type: Number
    },
    selectable: {
      type: Boolean,
      reflect: true
    }
  };

  declare selectable: boolean;

  #peers: PresencePeer[] = [];
  #max = Infinity;

  constructor() {
    super();

    this.selectable = false;
  }

  get peers(): ReadonlyArray<PresencePeer> {
    return this.#peers;
  }

  set peers(
    value: Iterable<PresencePeer>
  ) {
    const previous = this.#peers;
    this.#peers = [...value];
    this.requestUpdate("peers", previous);
  }

  get max(): number {
    return this.#max;
  }

  set max(
    value: number
  ) {
    const next = normalizePeerMax(value);
    if (next === this.#max) {
      return;
    }

    const previous = this.#max;
    this.#max = next;
    this.requestUpdate("max", previous);
  }

  protected get connectionLabel(): string {
    return this.#peers.length === 1 ?
      "1 person connected" :
      `${this.#peers.length} people connected`;
  }

  protected partition(): PeerPartition<PresencePeer> {
    return partitionPeers(this.#peers, this.#max);
  }

  protected isSelectable(
    peer: PresencePeer
  ): boolean {
    return this.selectable && !peer.self;
  }

  protected renderAvatar(
    peer: PresencePeer
  ): TemplateResult {
    return html`
      <jolly-avatar
        part="avatar"
        peer-id=${peer.peerId ?? peer.clientId}
        color=${peer.color}
        image=${peer.avatar ?? ""}
      ></jolly-avatar>
    `;
  }

  protected select(
    peer: PresencePeer
  ): void {
    emitPeerEvent(this, "jolly-peer-select", {
      clientId: peer.clientId
    });
  }
}
