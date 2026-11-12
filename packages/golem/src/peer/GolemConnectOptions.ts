// CONSTANTS
const kDefaultTimeoutMs = 10_000;

export interface GolemConnectOptions {
  /**
   * The studio address, such as "http://localhost:5173".
   * @default process.env.JOLLY_STUDIO_URL
   */
  url?: string | URL;
  /**
   * @default process.env.JOLLY_GOLEM_TOKEN
   */
  token?: string;
  /**
   * How long to wait for the catalog before giving up.
   * @default 10_000
   */
  timeoutMs?: number;
}

export interface GolemTarget {
  url: URL;
  token: string;
  timeoutMs: number;
}

export function golemTarget(
  options: GolemConnectOptions = {}
): GolemTarget {
  const {
    url = process.env.JOLLY_STUDIO_URL,
    token = process.env.JOLLY_GOLEM_TOKEN,
    timeoutMs = kDefaultTimeoutMs
  } = options;
  if (url === undefined || url === "") {
    throw new TypeError(
      "Golem needs the studio URL: pass url or set JOLLY_STUDIO_URL."
    );
  }
  if (token === undefined || token === "") {
    throw new TypeError(
      "Golem needs an agent token: pass token or set JOLLY_GOLEM_TOKEN."
    );
  }

  return {
    url: new URL(url),
    token,
    timeoutMs
  };
}
