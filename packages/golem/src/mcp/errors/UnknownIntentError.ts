export class UnknownIntentError extends Error {
  readonly intent: string;

  constructor(
    kind: string,
    intent: string,
    intents: readonly string[]
  ) {
    super(
      intents.length === 0 ?
        `"${kind}" assets have no intents; use asset_apply.` :
        `"${kind}" assets have no "${intent}" intent; they have ${intents.join(", ")}.`
    );
    this.name = "UnknownIntentError";
    this.intent = intent;
  }
}
