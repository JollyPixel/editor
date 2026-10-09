// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

// Import Third-party Dependencies
import {
  parseCookie,
  stringifySetCookie
} from "cookie";

// Import Internal Dependencies
import { isCrossOrigin } from "../http/core/origin.ts";
import { SessionToken } from "./SessionToken.ts";

// CONSTANTS
export const DEFAULT_SESSION_COOKIE = "jolly_session";
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export interface SessionCookieOptions {
  /**
   * @default DEFAULT_SESSION_COOKIE
   */
  name?: string;
  /**
   * Lifetime of a session, in milliseconds.
   * @default DEFAULT_SESSION_TTL_MS
   */
  ttlMs?: number;
}

export class SessionCookie {
  readonly name: string;
  readonly ttlMs: number;

  constructor(
    options: SessionCookieOptions = {}
  ) {
    this.name = options.name ?? DEFAULT_SESSION_COOKIE;
    this.ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  read(
    headers: IncomingHttpHeaders
  ): SessionToken | null {
    const header = headers.cookie;
    if (
      header === undefined ||
      isCrossOrigin(headers)
    ) {
      return null;
    }

    const value = parseCookie(header)[this.name];

    return value === undefined
      ? null
      : SessionToken.parse(value);
  }

  issue(
    token: SessionToken,
    secure: boolean
  ): string {
    return stringifySetCookie({
      name: this.name,
      value: token.value,
      maxAge: Math.floor(this.ttlMs / 1_000),
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "strict"
    });
  }

  clear(
    secure: boolean
  ): string {
    return stringifySetCookie({
      name: this.name,
      value: "",
      maxAge: 0,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "strict"
    });
  }
}
