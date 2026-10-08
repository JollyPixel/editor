// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";

// Import Internal Dependencies
import type {
  Accounts,
  AccountSession
} from "../Accounts.ts";
import { AccountsRequestError } from "./errors/AccountsRequestError.ts";
import { InvalidPasswordError } from "../session/errors/InvalidPasswordError.ts";
import { InvalidUsernameError } from "../account/errors/InvalidUsernameError.ts";
import { UsernameTakenError } from "../store/errors/UsernameTakenError.ts";
import { AccountsReply } from "./AccountsReply.ts";
import { AccountsRequest } from "./AccountsRequest.ts";
import {
  LoginLimiter,
  type LoginThrottleOptions
} from "./LoginLimiter.ts";

// CONSTANTS
const kDomainErrors = [
  {
    type: InvalidUsernameError,
    status: 400,
    code: "invalid-username"
  },
  {
    type: InvalidPasswordError,
    status: 400,
    code: "invalid-password"
  },
  {
    type: UsernameTakenError,
    status: 409,
    code: "username-taken"
  }
] as const;

export class AccountsEndpoint {
  #accounts: Accounts;
  #limiter: LoginLimiter;

  constructor(
    accounts: Accounts,
    throttle?: LoginThrottleOptions
  ) {
    this.#accounts = accounts;
    this.#limiter = new LoginLimiter(throttle);
  }

  async handle(
    route: string,
    message: IncomingMessage
  ): Promise<AccountsReply | null> {
    const request = new AccountsRequest(message);
    try {
      if (request.crossOrigin) {
        throw new AccountsRequestError(403, "cross-origin", "the request comes from another origin");
      }

      switch (route) {
        case "register":
          return await this.#register(request);
        case "login":
          return await this.#login(request);
        case "logout":
          return this.#logout(request);
        case "me":
          return this.#me(request);
        default:
          return null;
      }
    }
    catch (error) {
      const failure = requestError(error);
      if (failure === null) {
        throw error;
      }

      return AccountsReply.failure(failure);
    }
  }

  async #register(
    request: AccountsRequest
  ): Promise<AccountsReply> {
    request.expect("POST");
    const { username, password } = await request.credentials();

    return this.#signedIn(
      request,
      201,
      await this.#accounts.register(username, password)
    );
  }

  async #login(
    request: AccountsRequest
  ): Promise<AccountsReply> {
    request.expect("POST");
    const { username, password } = await request.credentials();
    const retryAfter = await this.#limiter.retryAfter(
      username,
      request.address
    );
    if (retryAfter > 0) {
      return AccountsReply.failure(
        new AccountsRequestError(429, "throttled", "too many failed sign-in attempts"),
        {
          "retry-after": String(Math.ceil(retryAfter / 1_000))
        }
      );
    }

    const session = await this.#accounts.login(username, password);
    if (session === null) {
      await this.#limiter.fail(username, request.address);

      throw new AccountsRequestError(401, "invalid-credentials", "wrong username or password");
    }
    await this.#limiter.succeed(username);

    return this.#signedIn(request, 200, session);
  }

  #logout(
    request: AccountsRequest
  ): AccountsReply {
    request.expect("POST");
    const token = request.sessionToken(this.#accounts.cookie);
    if (token !== null) {
      this.#accounts.logout(token);
    }

    return AccountsReply.empty(204, {
      "set-cookie": this.#accounts.cookie.clear(request.secure)
    });
  }

  #me(
    request: AccountsRequest
  ): AccountsReply {
    request.expect("GET");
    const token = request.sessionToken(this.#accounts.cookie);
    const account = token === null ?
      null :
      this.#accounts.accountForToken(token);
    if (account === null) {
      throw new AccountsRequestError(401, "unauthenticated", "no valid session");
    }

    return AccountsReply.json(200, { account });
  }

  #signedIn(
    request: AccountsRequest,
    status: number,
    session: AccountSession
  ): AccountsReply {
    return AccountsReply.json(
      status,
      {
        account: session.account
      },
      {
        "set-cookie": this.#accounts.cookie.issue(session.token, {
          maxAgeMs: this.#accounts.sessionTtlMs,
          secure: request.secure
        })
      }
    );
  }
}

function requestError(
  error: unknown
): AccountsRequestError | null {
  if (error instanceof AccountsRequestError) {
    return error;
  }

  for (const { type, status, code } of kDomainErrors) {
    if (error instanceof type) {
      return new AccountsRequestError(status, code, error.message);
    }
  }

  return null;
}
