// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import type { PeerSharing } from "../../session/OfflineMode.ts";

export interface PeerConsoleContext {
  peers?: PeerSharing;
}

export function peerConsole(
  commands: CommandConsole,
  { peers }: PeerConsoleContext
): RegistrationHandle {
  if (peers === undefined) {
    return {
      unregister: () => undefined
    };
  }

  const namespace = commands.registerNamespace("peer", {
    description: "Invite guests over WebRTC"
  });

  namespace.registerCommand("invite", {
    description: "Print a link that lets a guest join",
    args: [],
    execute: (_args, ctx) => {
      ctx.print(peers.invite().toUrl(location.href).href);
    }
  });
  namespace.registerCommand("stop", {
    description: "Revoke every invite and disconnect the guests",
    args: [],
    execute: (_args, ctx) => {
      const { guests } = peers;
      peers.stop();
      ctx.print(`Disconnected ${guests} guest(s).`);
    }
  });

  return namespace;
}
