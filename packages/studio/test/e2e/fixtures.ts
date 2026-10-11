// Import Third-party Dependencies
import { test as base } from "@playwright/test";
import { CommandConsole } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { registerAccount } from "./support/account.ts";
import { StudioShell } from "./support/studio.ts";

export { expect } from "@playwright/test";

export const test = base.extend<{
  studio: StudioShell;
  commands: CommandConsole;
  account: string;
}>({
  studio: async({ page }, use) => {
    await use(new StudioShell(page));
  },
  commands: async({ page }, use) => {
    await use(new CommandConsole(page));
  },
  account: async({ page }, use) => {
    await use(await registerAccount(page.request));
  }
});
