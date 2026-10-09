// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";

// Import Internal Dependencies
import type {
  Accounts,
  AccountSession
} from "../Accounts.ts";
import {
  AVATAR_MAX_BYTES,
  type Account
} from "../account/Account.ts";
import { InvalidAvatarError } from "../avatar/errors/InvalidAvatarError.ts";
import { AccountsRequestError } from "./errors/AccountsRequestError.ts";
import { InvalidPasswordError } from "../session/errors/InvalidPasswordError.ts";
import { InvalidUsernameError } from "../account/errors/InvalidUsernameError.ts";
import { UsernameTakenError } from "../store/errors/UsernameTakenError.ts";
import { InvalidMasterPasswordError } from "../registration/errors/InvalidMasterPasswordError.ts";
import { MasterPasswordRequiredError } from "../registration/errors/MasterPasswordRequiredError.ts";
import { AccountsReply } from "./AccountsReply.ts";
import { AccountsRequest } from "./AccountsRequest.ts";
import type { AccountsThrottle } from "./AccountsThrottle.ts";
import type { TrustedProxies } from "./TrustedProxies.ts";

// CONSTANTS
const kAvatarRoute = /^(?<accountId>[\w-]+)\/avatar$/;
const kAvatarContentType = "image/webp";
const kImmutable = "public, max-age=31536000, immutable";
const kRevalidate = "no-cache";
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
  },
  {
    type: MasterPasswordRequiredError,
    status: 403,
    code: "master-password-required"
  },
  {
    type: InvalidMasterPasswordError,
    status: 403,
    code: "invalid-master-password"
  },
  {
    type: InvalidAvatarError,
    status: 422,
    code: "invalid-avatar"
  }
] as const;

export class AccountsEndpoint {
  #accounts: Accounts;
  #throttle: AccountsThrottle;
  #proxies: TrustedProxies;

  constructor(
    accounts: Accounts,
    throttle: AccountsThrottle,
    proxies: TrustedProxies
  ) {
    this.#accounts = accounts;
    this.#throttle = throttle;
    this.#proxies = proxies;
  }

  async handle(
    route: string,
    message: IncomingMessage
  ): Promise<AccountsReply | null> {
    const request = new AccountsRequest(message, this.#proxies);
    try {
      if (request.crossOrigin) {
        throw new AccountsRequestError(403, "cross-origin", "the request comes from another origin");
      }

      const avatarOwner = kAvatarRoute.exec(route)?.groups?.accountId;
      if (avatarOwner !== undefined) {
        return this.#avatar(avatarOwner, request);
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
        case "avatar":
          return await this.#replaceAvatar(request);
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
    const {
      username,
      password,
      options
    } = await request.registration();
    const retryAfter = await this.#throttle.reserveRegistration(
      request.address
    );
    if (retryAfter > 0) {
      return throttled(retryAfter, "too many registrations");
    }

    return this.#signedIn(
      request,
      201,
      await this.#accounts.register(username, password, options)
    );
  }

  async #login(
    request: AccountsRequest
  ): Promise<AccountsReply> {
    request.expect("POST");
    const { username, password } = await request.credentials();
    const retryAfter = await this.#throttle.reserveLogin(
      username,
      request.address
    );
    if (retryAfter > 0) {
      return throttled(retryAfter, "too many failed sign-in attempts");
    }

    const session = await this.#accounts.login(username, password);
    if (session === null) {
      throw new AccountsRequestError(401, "invalid-credentials", "wrong username or password");
    }
    await this.#throttle.forgiveLogin(username, request.address);

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

    return AccountsReply.json(200, {
      account: this.#signedInAccount(request)
    });
  }

  async #replaceAvatar(
    request: AccountsRequest
  ): Promise<AccountsReply> {
    request.expect("PUT");
    const { id } = this.#signedInAccount(request);
    const image = await request.bytes(AVATAR_MAX_BYTES);

    return AccountsReply.json(200, {
      account: await this.#accounts.replaceAvatar(id, image)
    });
  }

  #avatar(
    accountId: string,
    request: AccountsRequest
  ): AccountsReply {
    request.expect("GET");
    const avatar = this.#accounts.avatar(accountId);
    if (avatar === null) {
      throw new AccountsRequestError(404, "not-found", "the account has no avatar");
    }

    return AccountsReply.image(
      avatar.bytes,
      kAvatarContentType,
      request.query("v") === avatar.hash ? kImmutable : kRevalidate
    );
  }

  #signedInAccount(
    request: AccountsRequest
  ): Account {
    const token = request.sessionToken(this.#accounts.cookie);
    const account = token === null ?
      null :
      this.#accounts.accountForToken(token);
    if (account === null) {
      throw new AccountsRequestError(401, "unauthenticated", "no valid session");
    }

    return account;
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

function throttled(
  retryAfterMs: number,
  message: string
): AccountsReply {
  return AccountsReply.failure(
    new AccountsRequestError(429, "throttled", message),
    {
      "retry-after": String(Math.ceil(retryAfterMs / 1_000))
    }
  );
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
