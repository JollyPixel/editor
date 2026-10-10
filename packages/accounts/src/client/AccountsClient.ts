// Import Internal Dependencies
import {
  AVATAR_MAX_BYTES,
  type Account
} from "../account/Account.ts";
import {
  ACCOUNTS_ROUTES,
  type AccountsRouteName
} from "../http/routes.ts";
import {
  accountReplySchema,
  failureReplySchema,
  type CredentialsBody,
  type RegistrationBody
} from "../http/routes.schema.ts";
import { AccountsRequestError } from "./errors/AccountsRequestError.ts";
import { InvalidPasswordError } from "../session/errors/InvalidPasswordError.ts";
import type { RegisterOptions } from "../registration/RegisterOptions.ts";
import type { RegistrationResult } from "../registration/RegistrationResult.ts";
import { Username } from "../account/Username.ts";
import { prehashPassword } from "./prehashPassword.ts";

// CONSTANTS
export const MIN_PASSWORD_LENGTH = 8;
const kAccepted = 202;
const kUnauthorized = 401;
const kBytesPerMegabyte = 1_024 * 1_024;

export interface AccountsClientOptions {
  /**
   * Base URL of the accounts handler, with a trailing slash.
   */
  url: string | URL;
  /**
   * @default globalThis.fetch
   */
  fetch?: typeof fetch;
}

type RequestBody = Blob | CredentialsBody | RegistrationBody;

export class AccountsClient {
  readonly url: URL;

  #fetch: typeof fetch;

  constructor(
    options: AccountsClientOptions
  ) {
    this.url = new URL(options.url);
    this.#fetch = options.fetch ?? globalThis.fetch.bind(
      globalThis
    );
  }

  async register(
    username: string,
    password: string,
    options: RegisterOptions = {}
  ): Promise<RegistrationResult> {
    if ([...password].length < MIN_PASSWORD_LENGTH) {
      throw new InvalidPasswordError(
        `a password has at least ${MIN_PASSWORD_LENGTH} characters`
      );
    }
    const credentials = await this.#credentials(username, password);
    const response = await this.#request("register", {
      ...credentials,
      masterPassword: options.masterPassword
    });
    if (response.status === kAccepted) {
      return {
        status: "pending"
      };
    }

    return {
      status: "active",
      account: await accountFrom(response)
    };
  }

  async login(
    username: string,
    password: string
  ): Promise<Account> {
    return this.#account(
      "login",
      await this.#credentials(username, password)
    );
  }

  async logout(): Promise<void> {
    const response = await this.#request("logout");
    if (!response.ok) {
      throw await requestError(response);
    }
  }

  async me(): Promise<Account | null> {
    const response = await this.#request("me");
    if (response.status === kUnauthorized) {
      return null;
    }

    return accountFrom(response);
  }

  async replaceAvatar(
    image: Blob
  ): Promise<Account> {
    if (image.size > AVATAR_MAX_BYTES) {
      throw new AccountsRequestError(
        413,
        "payload-too-large",
        `an avatar is at most ${AVATAR_MAX_BYTES / kBytesPerMegabyte} MB`
      );
    }

    return this.#account("replaceAvatar", image);
  }

  async #credentials(
    username: string,
    password: string
  ): Promise<CredentialsBody> {
    const parsed = Username.parse(username);

    return {
      username: parsed.value,
      password: await prehashPassword(parsed, password)
    };
  }

  async #account(
    route: AccountsRouteName,
    body: RequestBody
  ): Promise<Account> {
    return accountFrom(
      await this.#request(route, body)
    );
  }

  #request(
    route: AccountsRouteName,
    body?: RequestBody
  ): Promise<Response> {
    const { method, path } = ACCOUNTS_ROUTES[route];

    return this.#fetch(
      new URL(path, this.url),
      {
        method,
        credentials: "same-origin",
        ...requestBody(body)
      }
    );
  }
}

function requestBody(
  body: RequestBody | undefined
): Pick<RequestInit, "headers" | "body"> {
  if (body === undefined) {
    return {};
  }
  if (body instanceof Blob) {
    return {
      headers: {
        "content-type": body.type || "application/octet-stream"
      },
      body
    };
  }

  return {
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

async function accountFrom(
  response: Response
): Promise<Account> {
  if (!response.ok) {
    throw await requestError(response);
  }

  return accountReplySchema.parse(
    await response.json()
  ).account;
}

async function requestError(
  response: Response
): Promise<AccountsRequestError> {
  const body = failureReplySchema.safeParse(
    await response.json().catch(() => null)
  );

  return new AccountsRequestError(
    response.status,
    body.data?.code ?? "unknown",
    body.data?.message ?? response.statusText
  );
}
