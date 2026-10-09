// Import Third-party Dependencies
import {
  RateLimiterMemory,
  RateLimiterRes
} from "rate-limiter-flexible";

// Import Internal Dependencies
import type { Username } from "../account/Username.ts";
import { AccountsThrottledError } from "./errors/AccountsThrottledError.ts";

// CONSTANTS
const kDefaultAttempts = 10;
const kDefaultRegistrations = 10;
const kDefaultWindowMs = 15 * 60 * 1_000;

export interface AccountsThrottleOptions {
  /**
   * Failed logins allowed per username, and per client address, within
   * `windowMs`.
   * @default 10
   */
  attempts?: number;
  /**
   * Registrations allowed per client address within `windowMs`.
   * @default 10
   */
  registrations?: number;
  /**
   * @default 900_000
   */
  windowMs?: number;
}

export class AccountsThrottle {
  #logins: RateLimiterMemory;
  #registrations: RateLimiterMemory;

  constructor(
    options: AccountsThrottleOptions = {}
  ) {
    const {
      attempts = kDefaultAttempts,
      registrations = kDefaultRegistrations,
      windowMs = kDefaultWindowMs
    } = options;
    const duration = Math.ceil(windowMs / 1_000);
    this.#logins = new RateLimiterMemory({
      points: attempts,
      duration
    });
    this.#registrations = new RateLimiterMemory({
      points: registrations,
      duration
    });
  }

  async reserveLogin(
    username: Username,
    address: string
  ): Promise<void> {
    const retryAfterMs = await reserve(this.#logins, [
      userKey(username),
      addressKey(address)
    ]);
    if (retryAfterMs > 0) {
      throw new AccountsThrottledError(
        retryAfterMs,
        "too many failed sign-in attempts"
      );
    }
  }

  async forgiveLogin(
    username: Username,
    address: string
  ): Promise<void> {
    await Promise.all([
      this.#logins.delete(userKey(username)),
      this.#logins.reward(addressKey(address), 1)
    ]);
  }

  async reserveRegistration(
    address: string
  ): Promise<void> {
    const retryAfterMs = await reserve(this.#registrations, [
      addressKey(address)
    ]);
    if (retryAfterMs > 0) {
      throw new AccountsThrottledError(
        retryAfterMs,
        "too many registrations"
      );
    }
  }
}

async function reserve(
  limiter: RateLimiterMemory,
  keys: string[]
): Promise<number> {
  const outcomes = await Promise.allSettled(
    keys.map((key) => limiter.consume(key))
  );
  const waits = outcomes.flatMap((outcome) => (
    outcome.status === "rejected" ? [retryAfterMs(outcome.reason)] : []
  ));
  if (waits.length === 0) {
    return 0;
  }

  await Promise.all(
    keys
      .filter((_key, index) => outcomes[index].status === "fulfilled")
      .map((key) => limiter.reward(key, 1))
  );

  return Math.max(1, ...waits);
}

function retryAfterMs(
  reason: unknown
): number {
  if (reason instanceof RateLimiterRes) {
    return reason.msBeforeNext;
  }

  throw reason;
}

function userKey(
  username: Username
): string {
  return `user:${username.key}`;
}

function addressKey(
  address: string
): string {
  return `ip:${address}`;
}
