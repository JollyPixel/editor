// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import {
  AVATAR_MAX_BYTES,
  accountSchema,
  type Account
} from "../account/Account.ts";
import {
  ACCOUNTS_ERROR_CODES,
  AccountsRequestError
} from "../http/errors/AccountsRequestError.ts";
import { InvalidPasswordError } from "../session/errors/InvalidPasswordError.ts";
import { Username } from "../account/Username.ts";
import { prehashPassword } from "./prehashPassword.ts";

// CONSTANTS
export const MIN_PASSWORD_LENGTH = 8;
const kUnauthorized = 401;
const kBytesPerMegabyte = 1_024 * 1_024;
const kAccountBodySchema = z.object({
  account: accountSchema
});
const kErrorBodySchema = z.object({
  code: z.enum(ACCOUNTS_ERROR_CODES).catch("unknown"),
  message: z.string().optional().catch(undefined)
});

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

interface AccountsRequest {
  method: "GET" | "POST" | "PUT";
  body?: Blob | object;
}

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
    password: string
  ): Promise<Account> {
    if ([...password].length < MIN_PASSWORD_LENGTH) {
      throw new InvalidPasswordError(
        `a password has at least ${MIN_PASSWORD_LENGTH} characters`
      );
    }

    return this.#authenticate(
      "register",
      username,
      password
    );
  }

  login(
    username: string,
    password: string
  ): Promise<Account> {
    return this.#authenticate(
      "login",
      username,
      password
    );
  }

  async logout(): Promise<void> {
    const response = await this.#request("logout", {
      method: "POST"
    });
    if (!response.ok) {
      throw await requestError(response);
    }
  }

  async me(): Promise<Account | null> {
    const response = await this.#request("me", {
      method: "GET"
    });
    if (response.status === kUnauthorized) {
      return null;
    }
    if (!response.ok) {
      throw await requestError(response);
    }

    return kAccountBodySchema.parse(
      await response.json()
    ).account;
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

    const response = await this.#request("avatar", {
      method: "PUT",
      body: image
    });
    if (!response.ok) {
      throw await requestError(response);
    }

    return kAccountBodySchema.parse(
      await response.json()
    ).account;
  }

  async #authenticate(
    route: "register" | "login",
    username: string,
    password: string
  ): Promise<Account> {
    const parsed = Username.parse(username);

    const response = await this.#request(route, {
      method: "POST",
      body: {
        username: parsed.value,
        password: await prehashPassword(
          parsed,
          password
        )
      }
    });
    if (!response.ok) {
      throw await requestError(response);
    }

    return kAccountBodySchema.parse(
      await response.json()
    ).account;
  }

  #request(
    route: string,
    options: AccountsRequest
  ): Promise<Response> {
    return this.#fetch(
      new URL(route, this.url),
      {
        method: options.method,
        credentials: "same-origin",
        ...requestBody(options)
      }
    );
  }
}

function requestBody(
  { body }: AccountsRequest
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

async function requestError(
  response: Response
): Promise<AccountsRequestError> {
  const body = kErrorBodySchema.safeParse(
    await response.json().catch(() => null)
  );

  return new AccountsRequestError(
    response.status,
    body.data?.code ?? "unknown",
    body.data?.message ?? response.statusText
  );
}
