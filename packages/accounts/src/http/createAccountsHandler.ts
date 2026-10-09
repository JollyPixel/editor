// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Internal Dependencies
import type { AccountsEndpoint } from "./AccountsEndpoint.ts";

export type AccountsHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void
) => void;

export function createAccountsHandler(
  path: string,
  endpoint: AccountsEndpoint
): AccountsHandler {
  return function accountsHandler(
    request,
    response,
    next
  ) {
    const pathname = URL.parse(
      request.url ?? "",
      "http://localhost"
    )?.pathname;
    if (
      pathname === undefined ||
      !pathname.startsWith(path)
    ) {
      next();

      return;
    }

    endpoint
      .handle(pathname.slice(path.length), request)
      .then((reply) => {
        if (reply === null) {
          next();
        }
        else {
          reply.send(response);
        }
      })
      .catch(next);
  };
}
