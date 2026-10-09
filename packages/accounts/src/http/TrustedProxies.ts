// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

// CONSTANTS
const kUnknownAddress = "unknown";

export class TrustedProxies {
  readonly hops: number;

  constructor(
    hops = 0
  ) {
    if (!Number.isSafeInteger(hops) || hops < 0) {
      throw new RangeError(
        `proxyHops must be a non-negative integer, got ${hops}`
      );
    }
    this.hops = hops;
  }

  clientAddress(
    headers: IncomingHttpHeaders,
    peerAddress: string | undefined
  ): string {
    return this.#trusted(
      headers["x-forwarded-for"],
      peerAddress ?? kUnknownAddress
    );
  }

  isSecure(
    headers: IncomingHttpHeaders,
    encrypted: boolean
  ): boolean {
    const scheme = this.#trusted(
      headers["x-forwarded-proto"],
      encrypted ? "https" : "http"
    );

    return scheme.toLowerCase() === "https";
  }

  #trusted(
    header: string | string[] | undefined,
    peerValue: string
  ): string {
    const chain = [
      ...headerList(header),
      peerValue
    ];

    return chain[Math.max(0, chain.length - 1 - this.hops)];
  }
}

function headerList(
  value: string | string[] | undefined
): string[] {
  const joined = Array.isArray(value) ? value.join(",") : value ?? "";

  return joined
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}
