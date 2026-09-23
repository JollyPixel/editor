// Import Third-party Dependencies
import {
  test as base,
  type Page
} from "@playwright/test";
import type {
  CatalogClient
} from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import { withCatalog } from "./catalog.ts";
import {
  openEditor,
  type OpenEditorOptions
} from "./open.ts";

// CONSTANTS
const kUsername = "E2E";
const kPeerUsername = "Peer";

export interface EditorTarget {
  id: string;
}

export interface EditorFixtureOptions<TTarget extends EditorTarget> {
  socketUrl: string;
  create: (catalog: CatalogClient) => Promise<TTarget>;
  editor?: OpenEditorOptions;
}

export interface EditorFixtures<TTarget extends EditorTarget> {
  editor: OpenEditorOptions;
  target: TTarget;
  peer: Page;
}

export function editorFixture<TTarget extends EditorTarget>(
  options: EditorFixtureOptions<TTarget>
) {
  const {
    socketUrl,
    create,
    editor = {}
  } = options;

  return base.extend<EditorFixtures<TTarget>>({
    editor: [
      {
        username: kUsername,
        ...editor
      },
      { option: true }
    ],
    target: [
      async({ page, editor }, use) => {
        const target = await withCatalog(socketUrl, create);
        await openEditor(page, {
          ...editor,
          target: target.id
        });
        await use(target);
      },
      { auto: true }
    ],
    peer: async({ browser, editor, target }, use) => {
      const context = await browser.newContext();

      try {
        const page = await context.newPage();
        await openEditor(page, {
          ...editor,
          target: target.id,
          username: kPeerUsername
        });
        await use(page);
      }
      finally {
        await context.close();
      }
    }
  });
}
