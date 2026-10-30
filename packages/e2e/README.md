<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 💃 Getting Started

This workspace-private package is never published or built. It exports
TypeScript directly; Node and Playwright strip the types at run time. Add it as
a development dependency:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@jolly-pixel/e2e": "workspace:*"
  }
}
```

`@playwright/test` is a peer dependency, installed once at the repository root.

## 👀 Usage example

A suite has a `playwright.config.ts`:

```ts
// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.voxelModel,
  command: "pnpm run dev:e2e"
});
```

An editor suite also has a `test/e2e/fixtures.ts` that seeds the documents each
test opens on the config's `baseURL`:

```ts
// Import Third-party Dependencies
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";

export { expect } from "@playwright/test";

export const test = editorFixture({
  async create(catalog) {
    const id = await catalog.create(
      `${e2eFolder()}/model.voxelmodel.json`,
      encodeModelFile(),
      { kind: VOXEL_MODEL_KIND }
    );

    return { id };
  }
});
```

Specs import `test` and `expect` from it. The editor is already open and ready
when the test body runs:

```ts
// Import Third-party Dependencies
import { treeRow } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

test("opens the requested model with its default block", async({ page }) => {
  await expect(treeRow(page, "Block")).toBeVisible();
});
```

## 📚 API

### Suite

```ts
import {
  PORTS,
  RunMode,
  defineE2EConfig
} from "@jolly-pixel/e2e";
```

Configures a suite and drives the `@jolly-pixel/ui` components a page renders, without importing
`@jolly-pixel/ui` or an editor.

- Config: `defineE2EConfig`, `PORTS`, `baseUrl`, `RunMode` and the `prebundleWorkspace` Vite plugin
- Roles: `CookieAuthentication` and `ContextAccess`, one network role per browser context
- Browser: locators for dialogs, fields and tree rows, pointer geometry and drags, `recordSockets`
  and `CommandConsole`

### Editor

```ts
import {
  editorFixture,
  openEditor,
  pressAt
} from "@jolly-pixel/e2e/editor";
```

Seeds documents through the catalog and opens an editor on them, for editor and studio suites. It
relies on the editor host contracts: the `?target=`, `?username=`, `?max-fps=` and `?debug=` query
parameters, `data-editor-state` on `<html>` and `window.jollyEditor` in dev builds.

- Fixture: `editorFixture`, `withCatalog` and `e2eFolder`
- Navigation: `openEditor`, `reloadEditor`, `followEditor`, `waitForEditor` and `editorPath`
- Frames and input: `nextFrames` and `pressAt`
- Toolbar: `EditorToolbar`, the Asset and Version selects above the viewport

## ✨ Contributors guide

Read the [CONTRIBUTING][contributing] guide before contributing.

After making changes, run the tests and linter:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> New features and bug fixes need tests.

## 📃 License

MIT

[contributing]: ../../CONTRIBUTING.md
