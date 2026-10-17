// Import Internal Dependencies
import type { ClientHandle } from "#src/server/extension/ClientHandle.ts";
import type { PeerIdentity } from "#src/server/auth/AuthenticationProvider.ts";

export function createIdentity(
  handle: Pick<ClientHandle, "id"> | string,
  role = "default"
): PeerIdentity {
  return {
    subject: typeof handle === "string" ? handle : handle.id,
    role
  };
}
