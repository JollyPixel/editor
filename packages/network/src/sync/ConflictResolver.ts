// Import Internal Dependencies
import type { NetworkCommandHeader } from "../sync/types.ts";

export interface ConflictContext<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> {
  incoming: Header;
  existing: NetworkCommandHeader | undefined;
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

    if (incoming.clientId === existing.clientId) {
      return "accept";
    }

    if (incoming.timestamp > existing.timestamp) {
      return "accept";
    }

    if (incoming.timestamp < existing.timestamp) {
      return "reject";
    }

    return incoming.clientId >= existing.clientId ? "accept" : "reject";
  }
}
