// Import Internal Dependencies
import { InvalidPreferencesError } from "./InvalidPreferencesError.ts";

export class ChordConflictError extends InvalidPreferencesError {
  readonly chord: string;
  readonly key: string;
  readonly owner: string;

  constructor(
    scope: string,
    chord: string,
    key: string,
    owner: string
  ) {
    super(scope, `"${key}" takes "${chord}", already bound to "${owner}"`);
    this.name = "ChordConflictError";
    this.chord = chord;
    this.key = key;
    this.owner = owner;
  }
}
