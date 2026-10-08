// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import {
  expect,
  type APIRequestContext
} from "@playwright/test";
import {
  ACCOUNTS_URL_PATH,
  prehashPassword
} from "@jolly-pixel/accounts";

// CONSTANTS
export const E2E_PASSWORD = "e2e-password";

export function uniqueUsername(): string {
  return `e2e-${randomUUID().slice(0, 8)}`;
}

export async function registerAccount(
  request: APIRequestContext,
  username: string = uniqueUsername()
): Promise<string> {
  const response = await request.post(`${ACCOUNTS_URL_PATH}register`, {
    data: {
      username,
      password: await prehashPassword(username, E2E_PASSWORD)
    }
  });
  expect(response.ok()).toBe(true);

  return username;
}
