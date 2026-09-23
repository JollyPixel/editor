// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export interface OpenEditorOptions {
  target?: string;
  username?: string;
  maxFps?: number;
  query?: Record<string, string>;
}

export function editorPath(
  options: OpenEditorOptions = {}
): string {
  const {
    target,
    username,
    maxFps,
    query = {}
  } = options;

  const params = new URLSearchParams();
  if (target !== undefined) {
    params.set("target", target);
  }
  if (username !== undefined) {
    params.set("username", username);
  }
  if (maxFps !== undefined) {
    params.set("max-fps", String(maxFps));
  }
  for (const [name, value] of Object.entries(query)) {
    params.set(name, value);
  }
  const search = params.toString();

  return search === "" ? "/" : `/?${search}`;
}

export async function openEditor(
  page: Page,
  options: OpenEditorOptions = {}
): Promise<void> {
  await page.goto(editorPath(options));
  await waitForEditor(page);
}

export async function waitForEditor(
  page: Page
): Promise<void> {
  await page.waitForFunction(() => {
    const state = document.documentElement.dataset.editorState;
    if (state === "failed") {
      throw new Error("The editor failed to boot.");
    }

    return state === "ready";
  });
}
