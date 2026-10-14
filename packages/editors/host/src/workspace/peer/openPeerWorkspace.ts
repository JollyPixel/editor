// Import Third-party Dependencies
import { ChannelTransport } from "@jolly-pixel/network/client";
import { showChoice } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { GuestWorkspace } from "../GuestWorkspace.ts";
import type { PeerInvite } from "./PeerInvite.ts";
import { PeerLink } from "./PeerLink.ts";
import { PEER_CHANNEL_HOST } from "./protocol.ts";
import { BroadcastSignaling } from "./signaling/BroadcastSignaling.ts";

// CONSTANTS
const kReload = "reload";

export async function openPeerWorkspace(
  invite: PeerInvite
): Promise<GuestWorkspace> {
  const signaling = new BroadcastSignaling();
  let link: PeerLink;
  try {
    link = await PeerLink.offer({
      signaling,
      remote: invite.host,
      session: crypto.randomUUID()
    });
  }
  catch (error) {
    signaling.close();
    void showSessionNotice(
      "Host unreachable",
      "The host of this invite did not answer."
    );

    throw error;
  }

  return new GuestWorkspace({
    transport: new ChannelTransport({
      port: link.port,
      host: PEER_CHANNEL_HOST,
      credential: invite.token
    }),
    hostLost: link.closed,
    onHostLost: () => {
      void showSessionNotice(
        "Session ended",
        "The host closed the session."
      );
    },
    onClose: () => {
      link.close();
      signaling.close();
    },
    onUnauthorized: () => {
      void showSessionNotice(
        "Invite unavailable",
        "The host revoked this invite."
      );
    }
  });
}

async function showSessionNotice(
  title: string,
  message: string
): Promise<void> {
  const choice = await showChoice({
    title,
    message,
    actions: [
      {
        value: kReload,
        label: "Reload"
      }
    ],
    cancelLabel: "Close",
    focus: kReload
  });
  if (choice === kReload) {
    location.reload();
  }
}
