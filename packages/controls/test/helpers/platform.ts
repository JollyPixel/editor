// Import Node.js Dependencies
import type { TestContext } from "node:test";

export function mockPlatform(
  t: TestContext,
  platform: string
): void {
  t.mock.getter(navigator, "platform", () => platform);
}
