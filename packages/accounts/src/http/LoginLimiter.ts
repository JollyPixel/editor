// Import Third-party Dependencies
import { RateLimiterMemory } from "rate-limiter-flexible";

// Import Internal Dependencies
import type { Username } from "../account/Username.ts";

// CONSTANTS
const kDefaultAttempts = 10;
const kDefaultWindowMs = 15 * 60 * 1_000;

export interface LoginThrottleOptions {
  /**
   * Failed logins allowed per username, and per client address, within a
   * window.
   * @default 10
   */
  attempts?: number;
  /**
   * @default 900_000
   */
  windowMs?: number;
}

export class LoginLimiter {
  #attempts: number;
  #failures: RateLimiterMemory;

  constructor(
    options: LoginThrottleOptions = {}
  ) {
    const {
      attempts = kDefaultAttempts,
      windowMs = kDefaultWindowMs
    } = options;
    this.#attempts = attempts;
    this.#failures = new RateLimiterMemory({
      points: attempts,
      duration: Math.ceil(windowMs / 1_000)
    });
  }

  async retryAfter(
    username: Username,
    address: string
  ): Promise<number> {
    const windows = await Promise.all(
      keysFor(username, address).map(
        (key) => this.#failures.get(key)
      )
    );
    const blocked = windows.map((window) => (
      window !== null && window.consumedPoints >= this.#attempts ?
        window.msBeforeNext :
        0
    ));

    return Math.max(0, ...blocked);
  }

  async fail(
    username: Username,
    address: string
  ): Promise<void> {
    await Promise.allSettled(
      keysFor(username, address).map(
        (key) => this.#failures.consume(key)
      )
    );
  }

  async succeed(
    username: Username
  ): Promise<void> {
    await this.#failures.delete(
      userKey(username)
    );
  }
}

function userKey(
  username: Username
): string {
  return `user:${username.key}`;
}

function keysFor(
  username: Username,
  address: string
): string[] {
  return [
    userKey(username),
    `ip:${address}`
  ];
}
