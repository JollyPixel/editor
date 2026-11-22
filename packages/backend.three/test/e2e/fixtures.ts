// Import Third-party Dependencies
import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

export const test = base.extend({
  page: async({ page }, use) => {
    await page.route("https://unpkg.com/**", (route) => route.abort());
    await page.goto("/");
    await page.waitForFunction(() => "runtimeE2E" in window);

    await use(page);
  }
});
