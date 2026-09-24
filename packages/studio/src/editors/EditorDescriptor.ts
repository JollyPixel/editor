// CONSTANTS
export const EDITOR_PAGES_PREFIX = "/editors/";

/**
 * An editor page served at `EDITOR_PAGES_PREFIX + name + "/"`, opening the
 * assets of the listed kinds.
 */
export interface EditorDescriptor {
  name: string;
  kinds: readonly string[];
}
