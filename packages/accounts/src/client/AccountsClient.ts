// Import Internal Dependencies
import {
  AVATAR_MAX_BYTES,
  type Member
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
import { credentialsBody } from "./credentialsBody.ts";

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
    const credentials = await credentialsBody(username, password);
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
  ): Promise<Member> {
    return this.#account(
      "login",
      await credentialsBody(username, password)
    );
  }

  async join(): Promise<RegistrationResult> {
    const response = await this.#request("join");
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

  async logout(): Promise<void> {
    const response = await this.#request("logout");
    if (!response.ok) {
      throw await requestError(response);
    }
  }

  async me(): Promise<Member | null> {
    const response = await this.#request("me");
    if (response.status === kUnauthorized) {
      return null;
    }

    return accountFrom(response);
  }

  async replaceAvatar(
    image: Blob
  ): Promise<Member> {
    if (image.size > AVATAR_MAX_BYTES) {
      throw new AccountsRequestError(
        413,
        "payload-too-large",
        `an avatar is at most ${AVATAR_MAX_BYTES / kBytesPerMegabyte} MB`
      );
    }

    return this.#account("replaceAvatar", image);
  }

  async #account(
    route: AccountsRouteName,
    body: RequestBody
  ): Promise<Member> {
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
): Promise<Member> {
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
