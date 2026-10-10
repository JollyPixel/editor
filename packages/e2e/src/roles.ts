// Import Third-party Dependencies
import type { BrowserContext } from "@playwright/test";
import { parseCookie } from "cookie";
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity
} from "@jolly-pixel/network";
import type { Plugin } from "vite";

// CONSTANTS
const kRoleCookie = "jolly_e2e_role";
const kSubjectCookie = "jolly_e2e_subject";
const kRevokePath = "/__e2e/revoke";

export interface RoleGrant {
  role: string;
  subject: string;
}

type RevocationListener = (subject: string) => void;

export class CookieRoles implements AuthenticationProvider {
  readonly #listeners = new Set<RevocationListener>();

  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity {
    const header = request.headers.cookie;
    const cookies = typeof header === "string" ? parseCookie(header) : {};

    return {
      subject: cookies[kSubjectCookie] ?? request.clientId,
      role: cookies[kRoleCookie] ?? request.defaultRole
    };
  }

  watchRevocations(
    listener: RevocationListener
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  revoke(
    subject: string
  ): void {
    for (const listener of this.#listeners) {
      listener(subject);
    }
  }

  plugin(): Plugin {
    return {
      name: "jolly-pixel:e2e-roles",
      apply: "serve",
      configureServer: (server) => {
        server.middlewares.use(kRevokePath, (request, response) => {
          const subject = new URL(request.url ?? "/", "http://localhost")
            .searchParams
            .get("subject");
          if (request.method !== "POST" || subject === null) {
            response.statusCode = 400;
            response.end();

            return;
          }

          this.revoke(subject);
          response.statusCode = 204;
          response.end();
        });
      }
    };
  }
}

export async function grantRole(
  context: BrowserContext,
  url: string,
  grant: RoleGrant
): Promise<void> {
  await context.addCookies([
    {
      name: kRoleCookie,
      value: grant.role,
      url
    },
    {
      name: kSubjectCookie,
      value: grant.subject,
      url
    }
  ]);
}

export async function changeRole(
  context: BrowserContext,
  url: string,
  grant: RoleGrant
): Promise<void> {
  await grantRole(context, url, grant);
  const revoke = new URL(kRevokePath, url);
  revoke.searchParams.set(
    "subject",
    grant.subject
  );

  const response = await context.request.post(
    revoke.href
  );
  if (!response.ok()) {
    throw new Error(
      `revoking "${grant.subject}" failed with ${response.status()}`
    );
  }
}
