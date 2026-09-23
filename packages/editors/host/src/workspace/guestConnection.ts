// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";
import {
  Client,
  type ClientSocket
} from "@jolly-pixel/network/client";
import {
  GUEST_USERNAME,
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
  const peerId = crypto.randomUUID();
  const identity: PeerIdentity = {
    username: GUEST_USERNAME,
    peerId,
    color: colorFromKey(peerId)
  };

  return {
    identity,
    client: new Client({
      profile: toPeerMetadata(identity),
      socket
    })
  };
}
