// Import Third-party Dependencies
import { test as base } from "@playwright/test";

// Import Internal Dependencies
import {
  openExample,
  type ExampleOptions
} from "./support/gallery.ts";

export {
  expect,
  type Locator,
  type Page
} from "@playwright/test";

export interface GalleryFixtures {
  example: string | null;
  exampleOptions: ExampleOptions;
}

export const test = base.extend<GalleryFixtures>({
  example: [
    null,
    { option: true }
  ],
  exampleOptions: [
    {},
    { option: true }
  ],
  async page({ page, example, exampleOptions }, use) {
    if (example !== null) {
      await openExample(
        page,
        example,
        exampleOptions
      );
    }
    await use(page);
  }
});
