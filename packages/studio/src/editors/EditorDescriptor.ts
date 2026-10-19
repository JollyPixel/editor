// CONSTANTS
export const EDITOR_PAGES_DIR = "editors";
export const EDITOR_PAGES_PATH = `${EDITOR_PAGES_DIR}/`;
export const EDITOR_PAGES_PREFIX = `/${EDITOR_PAGES_PATH}`;
export const EDITOR_PAGE_REBUILT_EVENT = "studio:editor-page-rebuilt";

export interface EditorDescriptor {
  name: string;
  kinds: readonly string[];
  /**
   * Descriptors of the preference scopes the editor declares, as
   * `PreferenceScope.toJSON` writes them.
   */
  preferences?: readonly unknown[];
}

export interface EditorPageRebuilt {
  name: string;
}
