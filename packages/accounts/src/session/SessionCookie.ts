// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

// Import Third-party Dependencies
import {
  parseCookie,
  stringifySetCookie
} from "cookie";

// Import Internal Dependencies
import { SESSION_TOKEN_PATTERN } from "../store/sessionToken.ts";
import { isCrossOrigin } from "./origin.ts";

// CONSTANTS
export const DEFAULT_SESSION_COOKIE = "jolly_session";

export interface SessionCookieIssue {
  maxAgeMs: number;
  secure: boolean;
}

export class SessionCookie {
  readonly name: string;

  constructor(
    name: string = DEFAULT_SESSION_COOKIE
  ) {
    this.name = name;
  }

  read(
    headers: IncomingHttpHeaders
  ): string | null {
    const header = headers.cookie;
    if (header === undefined || isCrossOrigin(headers)) {
      return null;
    }

    const token = parseCookie(header)[this.name];

    return token !== undefined && SESSION_TOKEN_PATTERN.test(token)
      ? token
      : null;
  }

  issue(
    token: string,
    options: SessionCookieIssue
  ): string {
    return stringifySetCookie({
      name: this.name,
      value: token,
      maxAge: Math.floor(options.maxAgeMs / 1_000),
      path: "/",
      httpOnly: true,
      secure: options.secure,
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
