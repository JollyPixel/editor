// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { HOME_TAB_ID } from "./EditorTabs.ts";

// CONSTANTS
const kSavedTabsSchema = z.object({
  ids: z.array(z.string()),
  active: z.string()
});

export type SavedTabsJSON = z.infer<typeof kSavedTabsSchema>;

export class SavedTabs {
  static readonly EMPTY = new SavedTabs([], HOME_TAB_ID);

  static parse(
    text: string | null
  ): SavedTabs {
    if (text === null) {
      return SavedTabs.EMPTY;
    }

    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch {
      return SavedTabs.EMPTY;
    }

    const saved = kSavedTabsSchema.safeParse(value);
    if (!saved.success) {
      return SavedTabs.EMPTY;
    }

    return new SavedTabs(
      saved.data.ids,
      saved.data.active
    );
  }

  readonly ids: readonly string[];
  readonly active: string;

  constructor(
    ids: Iterable<string>,
    active: string
  ) {
    this.ids = Object.freeze([
      ...new Set(ids)
    ]);
    this.active = active;
  }

  toJSON(): SavedTabsJSON {
    return {
      ids: [
        ...this.ids
      ],
      active: this.active
    };
  }
}
