// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Internal Dependencies
import { ACCOUNTS_URL_PATH } from "../account/Account.ts";
import type { Accounts } from "../Accounts.ts";
import { AccountsEndpoint } from "./AccountsEndpoint.ts";
import type { LoginThrottleOptions } from "./LoginLimiter.ts";

export type AccountsHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void
) => void;

export interface AccountsHandlerOptions {
  path?: string;
  throttle?: LoginThrottleOptions;
}

export function createAccountsHandler(
  accounts: Accounts,
  options: AccountsHandlerOptions = {}
): AccountsHandler {
  const {
    path = ACCOUNTS_URL_PATH,
    throttle
  } = options;
  const endpoint = new AccountsEndpoint(accounts, throttle);

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
