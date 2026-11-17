export class TextMatchError extends Error {
  readonly search: string;
  readonly matches: number;

  constructor(
    search: string,
    matches: number
  ) {
    super(
      matches === 0 ?
        `The text has no ${JSON.stringify(search)}.` :
        `The text has ${matches} ${JSON.stringify(search)}: ` +
        "replace them all, or search a longer, unique part."
    );
    this.name = "TextMatchError";
    this.search = search;
    this.matches = matches;
  }
}
