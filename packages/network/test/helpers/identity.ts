// Import Internal Dependencies
import type { ClientHandle } from "#src/protocol/types.ts";
import type { PeerIdentity } from "#src/server/auth/AuthenticationProvider.ts";

export function identityOf(
  handle: ClientHandle | string,
  role = "default"
): PeerIdentity {
  return {
    subject: typeof handle === "string" ? handle : handle.id,
    role
  };
}
