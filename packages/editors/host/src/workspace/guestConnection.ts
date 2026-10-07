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
import { toPeerMetadata } from "@jolly-pixel/ui/network";

export interface GuestConnection {
  identity: PeerIdentity;
  client: Client;
}

export function guestConnection(
  socket: () => ClientSocket
): GuestConnection {
  const identity = peerIdentity(GUEST_USERNAME);

  return {
    identity,
    client: new Client({
      profile: toPeerMetadata(identity),
      socket
    })
  };
}
