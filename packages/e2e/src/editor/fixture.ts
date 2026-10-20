// Import Third-party Dependencies
import {
  test as base,
  type Page,
  type TestInfo
} from "@playwright/test";
import type {
  CatalogClient
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { ContextAccess } from "../roles/ContextAccess.ts";
import { DEFAULT_ROLE } from "../roles/protocol.ts";
import { withCatalog } from "./catalog.ts";
import {
  openEditor,
  type OpenEditorOptions
} from "./navigation.ts";

// CONSTANTS
const kUsername = "E2E";
const kPeerUsername = "Peer";

export interface EditorTarget {
  id: string;
}

export interface EditorFixtureOptions<TTarget extends EditorTarget> {
  create: (catalog: CatalogClient) => Promise<TTarget>;
  editor?: Omit<OpenEditorOptions, "target">;
}

export interface EditorFixtures<TTarget extends EditorTarget> {
  editor: Omit<OpenEditorOptions, "target">;
  role: string;
  target: TTarget;
  access: ContextAccess;
  peer: Page;
}

export function editorFixture<TTarget extends EditorTarget>(
  options: EditorFixtureOptions<TTarget>
) {
  const {
    create,
    editor = {}
  } = options;

  return base.extend<EditorFixtures<TTarget>>({
    editor: [editor, { option: true }],
    role: [DEFAULT_ROLE, { option: true }],
    access: async({ context, baseURL, role }, use, testInfo) => {
      const access = new ContextAccess({
        context,
        url: requireBaseURL(baseURL),
        subject: testSubject(testInfo)
      });
      await access.grant(role);
      await use(access);
    },
    target: [
      async({ page, access: _access, editor, baseURL }, use) => {
        const target = await withCatalog(requireBaseURL(baseURL), create);
        await openEditor(page, {
          username: kUsername,
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

function requireBaseURL(
  baseURL: string | undefined
): string {
  if (baseURL === undefined) {
    throw new Error("editorFixture needs use.baseURL, set by defineE2EConfig.");
  }

  return baseURL;
}

function testSubject(
  testInfo: TestInfo
): string {
  return `${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
}
