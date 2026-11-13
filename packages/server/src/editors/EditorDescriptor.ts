// CONSTANTS
export const EDITOR_PAGES_DIR = "editors";
export const EDITOR_PAGES_PATH = `${EDITOR_PAGES_DIR}/`;
export const EDITOR_PAGES_PREFIX = `/${EDITOR_PAGES_PATH}`;
export const EDITOR_PAGE_FILE = "index.html";

export const PREVIEW_PAGE_DIR = "preview";
export const PREVIEW_PAGE_PATH = `${PREVIEW_PAGE_DIR}/${EDITOR_PAGE_FILE}`;
export const PLAY_PAGE_DIR = "play";
export const PLAY_PAGE_PATH = `${PLAY_PAGE_DIR}/${EDITOR_PAGE_FILE}`;

export interface SceneComponentDeclaration {
  type: string;
  /**
   * The asset kind each asset slot takes, by slot name.
   */
  assets: Readonly<Record<string, string>>;
}

export interface EditorDescriptor {
  name: string;
  kinds: readonly string[];
  /**
   * Descriptors of the preference scopes the editor declares, as
   * `PreferenceScope.toJSON` writes them.
   */
  preferences?: readonly unknown[];
  /**
   * Descriptors of the scopes another editor declares and this one reads too.
   */
  sharedPreferences?: readonly unknown[];
  /**
   * The scene components the editor's package declares in
   * `jollypixel.sceneComponents`.
   */
  sceneComponents?: readonly SceneComponentDeclaration[];
}
