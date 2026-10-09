// Import Internal Dependencies
import {
  AVATAR_MAX_BYTES,
  type Account
} from "../../account/Account.ts";
import { Username } from "../../account/Username.ts";
import type {
  AccountDirectory,
  Credentials
} from "../../AccountDirectory.ts";
import type { CookieSessions } from "../../session/CookieSessions.ts";
import { PasswordDigest } from "../../session/PasswordDigest.ts";
import { HttpError } from "../core/errors/HttpError.ts";
import { HttpReply } from "../core/HttpReply.ts";
import type { HttpRequest } from "../core/HttpRequest.ts";
import type { HttpRoute } from "../core/HttpRoute.ts";
import {
  ACCOUNTS_ROUTES,
  AVATAR_VERSION_PARAM
} from "./routes.ts";
import {
  credentialsBodySchema,
  registrationBodySchema,
  type AccountReply,
  type CredentialsBody
} from "./routes.schema.ts";

// CONSTANTS
const kAvatarContentType = "image/webp";
const kImmutable = "public, max-age=31536000, immutable";
const kRevalidate = "no-cache";

export class AccountsApi implements Iterable<HttpRoute> {
  #directory: AccountDirectory;
  #sessions: CookieSessions;

  constructor(
    directory: AccountDirectory,
    sessions: CookieSessions
  ) {
    this.#directory = directory;
    this.#sessions = sessions;
  }

  * [Symbol.iterator](): IterableIterator<HttpRoute> {
    yield {
      ...ACCOUNTS_ROUTES.register,
      handle: (request) => this.#register(request)
    };
    yield {
      ...ACCOUNTS_ROUTES.login,
      handle: (request) => this.#login(request)
    };
    yield {
      ...ACCOUNTS_ROUTES.logout,
      handle: (request) => this.#logout(request)
    };
    yield {
      ...ACCOUNTS_ROUTES.me,
      handle: (request) => accountReply(200, this.#signedInAccount(request))
    };
    yield {
      ...ACCOUNTS_ROUTES.replaceAvatar,
      handle: (request) => this.#replaceAvatar(request)
    };
    yield {
      ...ACCOUNTS_ROUTES.avatar,
      handle: (request) => this.#avatar(request)
    };
  }

  async #register(
    request: HttpRequest
  ): Promise<HttpReply> {
    const body = await request.json(registrationBodySchema);
    const registration = await this.#directory.register(
      {
        ...parseCredentials(body),
        options: {
          masterPassword: body.masterPassword
        }
      },
      request.address
    );

    return registration.status === "pending" ?
      HttpReply.empty(202) :
      this.#signedIn(request, 201, registration.account);
  }

  async #login(
    request: HttpRequest
  ): Promise<HttpReply> {
    const body = await request.json(credentialsBodySchema);
    const account = await this.#directory.login(
      parseCredentials(body),
      request.address
    );

    return this.#signedIn(request, 200, account);
  }

  #logout(
    request: HttpRequest
  ): HttpReply {
    return HttpReply.empty(204, {
      "set-cookie": this.#sessions.close(request.headers, request.secure)
    });
  }

  async #replaceAvatar(
    request: HttpRequest
  ): Promise<HttpReply> {
    const { id } = this.#signedInAccount(request);
    const image = await request.bytes(AVATAR_MAX_BYTES);

    return accountReply(
      200,
      await this.#directory.replaceAvatar(id, image)
    );
  }

  #avatar(
    request: HttpRequest
  ): HttpReply {
    const avatar = this.#directory.avatar(request.params.accountId);
    if (avatar === null) {
      throw new HttpError(404, "not-found", "the account has no avatar");
    }
    const version = request.url.searchParams.get(AVATAR_VERSION_PARAM);

    return HttpReply.bytes(avatar.bytes, {
      "content-type": kAvatarContentType,
      "cache-control": version === avatar.hash ? kImmutable : kRevalidate,
      "cross-origin-resource-policy": "same-origin"
    });
  }

  #signedInAccount(
    request: HttpRequest
  ): Account {
    const account = this.#sessions.account(request.headers);
    if (account === null) {
      throw new HttpError(401, "unauthenticated", "no valid session");
    }

    return account;
  }

  #signedIn(
    request: HttpRequest,
    status: number,
    account: Account
  ): HttpReply {
    return accountReply(status, account, {
      "set-cookie": this.#sessions.open(account, request.secure)
    });
  }
}

function accountReply(
  status: number,
  account: Account,
  headers: Record<string, string> = {}
): HttpReply {
  const body: AccountReply = {
    account
  };

  return HttpReply.json(status, body, headers);
}

function parseCredentials(
  body: CredentialsBody
): Credentials {
  return {
    username: Username.parse(body.username),
    password: PasswordDigest.parse(body.password)
  };
}
