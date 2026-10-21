// Import Third-party Dependencies
import { test as base } from "@playwright/test";

// Import Internal Dependencies
import { LanternExample } from "./support/lanternExample.ts";

export { expect } from "@playwright/test";

export const test = base.extend<{ example: LanternExample; }>({
  example: async({ page }, use) => {
    const example = new LanternExample(page);
    await example.open();

    await use(example);
  }
});
