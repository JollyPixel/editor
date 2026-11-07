// CONSTANTS
const kFragmentKey = "peer";
const kSeparator = ".";
const kIdentifier = /^[\w-]{1,128}$/;

export class PeerInvite {
  static fromHash(
    hash: string
  ): PeerInvite | undefined {
    const value = new URLSearchParams(hash.replace(/^#/, "")).get(kFragmentKey);
    const [host, token, ...rest] = value?.split(kSeparator) ?? [];
    if (
      rest.length > 0 ||
      !PeerInvite.#isIdentifier(host) ||
      !PeerInvite.#isIdentifier(token)
    ) {
      return undefined;
    }

    return new PeerInvite(host, token);
  }

  static #isIdentifier(
    value: string | undefined
  ): value is string {
    return value !== undefined && kIdentifier.test(value);
  }

  readonly host: string;
  readonly token: string;

  constructor(
    host: string,
    token: string
  ) {
    if (!PeerInvite.#isIdentifier(host) || !PeerInvite.#isIdentifier(token)) {
      throw new RangeError("A peer invite holds a host id and a token.");
    }

    this.host = host;
    this.token = token;
  }

  toUrl(
    page: string | URL
  ): URL {
    const url = new URL(page);
    url.hash = new URLSearchParams({
      [kFragmentKey]: this.host + kSeparator + this.token
    }).toString();

    return url;
  }
}
