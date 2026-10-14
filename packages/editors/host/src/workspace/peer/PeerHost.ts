// Import Third-party Dependencies
import {
  ChannelTransportHost,
  type ClientSocket
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { PeerSharing } from "../SessionWorkspace.ts";
import { PeerInvite } from "./PeerInvite.ts";
import type { PeerInvites } from "./PeerInvites.ts";
import { PeerLink } from "./PeerLink.ts";
import { PEER_CHANNEL_HOST } from "./protocol.ts";
import type { PeerSignaling } from "./signaling/PeerSignaling.ts";

// CONSTANTS
const kNoToken = "";

export interface PeerHostOptions {
  signaling: PeerSignaling;
  invites: PeerInvites;
  open: (token: string) => ClientSocket;
  iceServers?: RTCIceServer[];
}

interface PeerGuest {
  readonly link: PeerLink;
  readonly relay: ChannelTransportHost;
}

export class PeerHost implements PeerSharing {
  readonly #signaling: PeerSignaling;
  readonly #invites: PeerInvites;
  readonly #open: (token: string) => ClientSocket;
  readonly #iceServers: RTCIceServer[] | undefined;
  readonly #guests = new Map<string, PeerGuest>();
  readonly #answering = new Set<string>();
  readonly #unsubscribe: () => void;
  #closed = false;

  constructor(
    options: PeerHostOptions
  ) {
    this.#signaling = options.signaling;
    this.#invites = options.invites;
    this.#open = options.open;
    this.#iceServers = options.iceServers;
    this.#unsubscribe = this.#signaling.subscribe((message) => {
      if (message.signal.type === "offer") {
        void this.#accept(message.from, message.session, message.signal.sdp);
      }
    });
  }

  get id(): string {
    return this.#signaling.id;
  }

  get guests(): number {
    return this.#guests.size;
  }

  invite(): PeerInvite {
    if (this.#closed) {
      throw new Error("The peer host is closed.");
    }

    return new PeerInvite(this.id, this.#invites.issue());
  }

  stop(): void {
    this.#invites.clear();
    for (const guest of [...this.#guests.values()]) {
      guest.relay.close();
      guest.link.close();
    }
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#unsubscribe();
    this.stop();
    this.#signaling.close();
  }

  async #accept(
    remote: string,
    session: string,
    offer: string
  ): Promise<void> {
    if (
      this.#closed ||
      this.#invites.size === 0 ||
      this.#guests.has(session) ||
      this.#answering.has(session)
    ) {
      return;
    }

    this.#answering.add(session);
    let link: PeerLink;
    try {
      link = await PeerLink.answer({
        signaling: this.#signaling,
        remote,
        session,
        offer,
        iceServers: this.#iceServers
      });
    }
    catch {
      return;
    }
    finally {
      this.#answering.delete(session);
    }
    if (this.#closed) {
      link.close();

      return;
    }

    const relay = new ChannelTransportHost({
      id: PEER_CHANNEL_HOST,
      port: link.port,
      open: ({ credential }) => this.#open(credential ?? kNoToken)
    });
    this.#guests.set(session, {
      link,
      relay
    });
    void link.closed.then(() => {
      relay.close();
      this.#guests.delete(session);
    });
  }
}
