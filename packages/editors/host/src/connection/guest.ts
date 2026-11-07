// Import Third-party Dependencies
import {
  Client,
  type ClientSocket
} from "@jolly-pixel/network/client";
import {
  GUEST_USERNAME,
  peerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";

export interface GuestConnection {
  identity: PeerIdentity;
  client: Client;
}

export interface GuestConnectionOptions {
  trustServer?: boolean;
}

export function guestConnection(
  socket: () => ClientSocket,
  options: GuestConnectionOptions = {}
): GuestConnection {
  const identity = peerIdentity(GUEST_USERNAME);

  return {
    identity,
    client: new Client({
      profile: toPeerProfileMetadata(identity),
      socket,
      trustServer: options.trustServer ?? false
    })
  };
}
