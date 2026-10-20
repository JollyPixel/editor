// Import Third-party Dependencies
import { parseCookie } from "cookie";
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity
} from "@jolly-pixel/network";
import type { Plugin } from "vite";

// Import Internal Dependencies
import {
  REVOKE_PATH,
  ROLE_COOKIE,
  SUBJECT_COOKIE
} from "./protocol.ts";

type RevocationListener = (subject: string) => void;

export class CookieAuthentication implements AuthenticationProvider {
  readonly #listeners = new Set<RevocationListener>();

  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity {
    const header = request.headers.cookie;
    const cookies = typeof header === "string" ? parseCookie(header) : {};

    return {
      subject: cookies[SUBJECT_COOKIE] ?? request.clientId,
      role: cookies[ROLE_COOKIE] ?? request.defaultRole
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
      name: "jolly-pixel:cookie-authentication",
      apply: "serve",
      configureServer: (server) => {
        server.middlewares.use(REVOKE_PATH, (request, response) => {
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
