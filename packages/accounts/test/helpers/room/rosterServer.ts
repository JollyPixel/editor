// Import Third-party Dependencies
import {
  Client,
  LoopbackTransport,
  Server
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  AccountsRoster,
  type RosterEntry
} from "#src/index.ts";
import type { AccountDirectory } from "#src/AccountDirectory.ts";
import { AccountsExtension } from "#src/room/AccountsExtension.ts";

export interface Peer {
  role: string;
  subject: string;
}

export interface RosterServer extends AsyncDisposable {
  connect(
    peer: Peer
  ): Promise<AccountsRoster>;
}

export function rosterServer(
  directory: AccountDirectory,
  revocations = true
): RosterServer {
  const peers: Peer[] = [];
  const clients: Client[] = [];
  const rosters: AccountsRoster[] = [];
  const server = new Server({
    auth: {
      authenticate: () => peers.shift() ?? null,
      watchRevocations: revocations ?
        (listener) => directory.watchRevocations(listener) :
        undefined
    }
  });
  server.register(new AccountsExtension(directory));
  const loopback = new LoopbackTransport({ server });

  return {
    async connect(peer) {
      peers.push(peer);
      const client = new Client({
        socket: () => loopback.connect(),
        reconnect: false
      });
      const roster = AccountsRoster.join(client);
      clients.push(client);
      rosters.push(roster);
      await roster.ready;

      return roster;
    },
    async [Symbol.asyncDispose]() {
      for (const roster of rosters) {
        roster.dispose();
      }
      for (const client of clients) {
        client.destroy();
      }
      await server.close();
    }
  };
}

export function nextChange(
  roster: AccountsRoster
): Promise<RosterEntry[]> {
  const { promise, resolve } = Promise.withResolvers<RosterEntry[]>();
  roster.once("change", () => resolve([...roster]));

  return promise;
}
