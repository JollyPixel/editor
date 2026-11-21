// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const EDITOR_PAGES_DIR = "editors";
export const EDITOR_PAGES_PATH = `${EDITOR_PAGES_DIR}/`;
export const EDITOR_PAGES_PREFIX = `/${EDITOR_PAGES_PATH}`;
export const EDITOR_PAGE_FILE = "index.html";

export const PREVIEW_PAGE_DIR = "preview";
export const PREVIEW_PAGE_PATH = `${PREVIEW_PAGE_DIR}/${EDITOR_PAGE_FILE}`;
export const PLAY_PAGE_DIR = "play";
export const PLAY_PAGE_PATH = `${PLAY_PAGE_DIR}/${EDITOR_PAGE_FILE}`;
export const PLAY_PAGE_PATHNAMES: ReadonlySet<string> = new Set([
  `/${PLAY_PAGE_DIR}/`,
  `/${PLAY_PAGE_PATH}`
]);

export const editorDescriptorSchema = z.object({
  name: z.string(),
  package: z.string(),
  kinds: z.array(z.string()),
  preferences: z.array(z.unknown()).default([]),
  sharedPreferences: z.array(z.unknown()).default([])
});

export type EditorDescriptor = z.infer<typeof editorDescriptorSchema>;
