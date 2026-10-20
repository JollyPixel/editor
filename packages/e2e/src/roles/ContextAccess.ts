// Import Third-party Dependencies
import type { BrowserContext } from "@playwright/test";

// Import Internal Dependencies
import {
  REVOKE_PATH,
  ROLE_COOKIE,
  SUBJECT_COOKIE
} from "./protocol.ts";

export type AccessContext = Pick<BrowserContext, "addCookies" | "request">;

export interface ContextAccessOptions {
  context: AccessContext;
  url: string;
  subject: string;
}

export class ContextAccess {
  readonly subject: string;
  readonly #context: AccessContext;
  readonly #url: string;

  constructor(
    options: ContextAccessOptions
  ) {
    this.subject = options.subject;
    this.#context = options.context;
    this.#url = options.url;
  }

  async grant(
    role: string
  ): Promise<void> {
    await this.#context.addCookies([
      {
        name: ROLE_COOKIE,
        value: role,
        url: this.#url
      },
      {
        name: SUBJECT_COOKIE,
        value: this.subject,
        url: this.#url
      }
    ]);
  }

  async become(
    role: string
  ): Promise<void> {
    await this.grant(role);
    const revoke = new URL(REVOKE_PATH, this.#url);
    revoke.searchParams.set("subject", this.subject);

    const response = await this.#context.request.post(revoke.href);
    if (!response.ok()) {
      throw new Error(
        `revoking "${this.subject}" failed with ${response.status()}`
      );
    }
  }
}
