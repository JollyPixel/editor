// CONSTANTS
export const EDITOR_PAGES_DIR = "editors";
export const EDITOR_PAGES_PREFIX = `/${EDITOR_PAGES_DIR}/`;

/**
 * An editor page served at `EDITOR_PAGES_PREFIX + name + "/"`, opening the
 * assets of the listed kinds.
 */
export interface EditorDescriptor {
  name: string;
  kinds: readonly string[];
}
