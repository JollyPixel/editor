// Import Third-party Dependencies
import * as z from "zod";
import type {
  PreferenceOverrides,
  PreferenceScope,
  Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { FileDownload } from "../browser/FileDownload.ts";
import { InvalidPreferencesFileError } from "./errors/InvalidPreferencesFileError.ts";
import type { PreferenceScopes } from "../../shared/PreferenceScopes.ts";

// CONSTANTS
export const PREFERENCES_FILE_NAME = "jollypixel-preferences.json";
const kPreferencesFileSchema = z.object({
  preferences: z.record(z.string(), z.unknown())
});

export interface PreferencesFileJSON {
  preferences: Record<string, PreferenceOverrides>;
}

export class PreferencesFile {
  static export(
    preferences: Pick<Preferences, "overrides">,
    scopes: Iterable<PreferenceScope>
  ): PreferencesFile {
    return new PreferencesFile(
      [...scopes].map((scope) => [scope, preferences.overrides(scope.name)])
    );
  }

  static async read(
    file: Blob,
    scopes: Pick<PreferenceScopes, "find">
  ): Promise<PreferencesFile> {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    }
    catch (error) {
      throw new InvalidPreferencesFileError("it is not JSON", { cause: error });
    }

    const data = kPreferencesFileSchema.safeParse(json);
    if (!data.success) {
      throw new InvalidPreferencesFileError("it has no preferences object");
    }

    return new PreferencesFile(
      Object.entries(data.data.preferences).flatMap(([name, value]) => {
        const scope = scopes.find(name);

        return scope === undefined ?
          [] :
          [[scope, scope.parse(scope.prune(value))] as const];
      })
    );
  }

  #scopes: ReadonlyMap<PreferenceScope, PreferenceOverrides>;

  constructor(
    scopes: Iterable<readonly [PreferenceScope, PreferenceOverrides]>
  ) {
    this.#scopes = new Map(scopes);
  }

  get size(): number {
    return this.#scopes.size;
  }

  applyTo(
    preferences: Pick<Preferences, "update">
  ): void {
    for (const [scope, overrides] of this.#scopes) {
      preferences.update(scope, {
        ...scope.defaults,
        ...overrides
      });
    }
  }

  toDownload(): FileDownload {
    return new FileDownload(
      new Blob([JSON.stringify(this, null, 2)], {
        type: "application/json"
      }),
      PREFERENCES_FILE_NAME
    );
  }

  toJSON(): PreferencesFileJSON {
    return {
      preferences: Object.fromEntries(
        [...this.#scopes].map(([scope, overrides]) => [scope.name, overrides])
      )
    };
  }
}
