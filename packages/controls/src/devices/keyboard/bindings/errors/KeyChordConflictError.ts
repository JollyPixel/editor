export class KeyChordConflictError extends Error {
  readonly chord: string;
  readonly actions: readonly [string, string];

  constructor(
    chord: string,
    firstAction: string,
    secondAction: string
  ) {
    super(
      `Key chord "${chord}" is bound to both "${firstAction}" and "${secondAction}"`
    );
    this.name = "KeyChordConflictError";
    this.chord = chord;
    this.actions = [firstAction, secondAction];
  }
}
