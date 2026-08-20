// Import Internal Dependencies
import type { NetworkCommandHeader } from "../sync/types.ts";

export interface ConflictContext<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> {
  incoming: Header;
  existing: Header | undefined;
}

export interface ConflictResolver<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> {
  resolve(
    ctx: ConflictContext<Header>
  ): "accept" | "reject";
}

export class LastWriteWinsResolver<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> implements ConflictResolver<Header> {
  resolve(
    ctx: ConflictContext<Header>
  ): "accept" | "reject" {
    const { incoming, existing } = ctx;

    if (!existing) {
      return "accept";
    }

    // Accept same-client replay in sequence because timestamps may be old.
    if (incoming.clientId === existing.clientId) {
      return "accept";
    }

    if (incoming.timestamp > existing.timestamp) {
      return "accept";
    }

    if (incoming.timestamp < existing.timestamp) {
      return "reject";
    }

    // Tie-break: lexicographically greater clientId wins.
    return incoming.clientId >= existing.clientId ? "accept" : "reject";
  }
}
