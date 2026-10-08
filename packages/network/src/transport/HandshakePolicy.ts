// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";
import { isIP } from "node:net";

// CONSTANTS
const kLocalhost = "localhost";
const kLocalhostSuffix = ".localhost";

export type HandshakeRefusal = "host" | "origin";

export interface HandshakePolicyOptions {
  allowedHosts?: readonly string[] | true;
  allowedOrigins?: readonly string[] | true;
}

export class HandshakePolicy {
  #allowedHosts: readonly string[] | true;
  #allowedOrigins: ReadonlySet<string> | true;

  constructor(
    options: HandshakePolicyOptions = {}
  ) {
    const {
      allowedHosts = [],
      allowedOrigins = []
    } = options;

    this.#allowedHosts = allowedHosts === true ?
      true :
      allowedHosts.map((host) => host.toLowerCase());
    this.#allowedOrigins = allowedOrigins === true ?
      true :
      new Set(allowedOrigins);
  }

  refusalFor(
    headers: IncomingHttpHeaders
  ): HandshakeRefusal | null {
    const host = headers.host?.toLowerCase();
    if (host === undefined || !this.#admitsHost(host)) {
      return "host";
    }
    if (!this.#admitsOrigin(headers.origin, host)) {
      return "origin";
    }

    return null;
  }

  #admitsHost(
    host: string
  ): boolean {
    if (this.#allowedHosts === true) {
      return true;
    }

    const hostname = URL.parse(`http://${host}`)?.hostname;
    if (hostname === undefined) {
      return false;
    }
    if (
      isIP(hostname.replace(/^\[|\]$/g, "")) !== 0 ||
      hostname === kLocalhost ||
      hostname.endsWith(kLocalhostSuffix)
    ) {
      return true;
    }

    return this.#allowedHosts.some((allowed) => (
      allowed.startsWith(".") ?
        hostname === allowed.slice(1) || hostname.endsWith(allowed) :
        hostname === allowed
    ));
  }

  #admitsOrigin(
    origin: string | undefined,
    host: string
  ): boolean {
    if (
      origin === undefined ||
      this.#allowedOrigins === true ||
      this.#allowedOrigins.has(origin)
    ) {
      return true;
    }

    return URL.parse(origin)?.host === host;
  }
}
