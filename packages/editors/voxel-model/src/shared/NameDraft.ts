/** Why a name is refused, or `null` to accept it. */
export type NameValidator = (name: string) => string | null;

export interface NameFieldOptions {
  /** Prefilled, and used when the field is left blank. */
  defaultName: string;
  validate?: NameValidator;
}

export class NameDraft {
  static from(
    options: NameFieldOptions
  ): NameDraft {
    return new NameDraft(options.defaultName, options.validate);
  }

  readonly text: string;
  readonly #fallback: string;
  readonly #validate: NameValidator;

  constructor(
    fallback: string,
    validate: NameValidator = () => null,
    text = fallback
  ) {
    this.text = text;
    this.#fallback = fallback;
    this.#validate = validate;
  }

  get name(): string {
    return this.text.trim() || this.#fallback;
  }

  get error(): string | null {
    return this.#validate(this.name);
  }

  edit(
    text: string
  ): NameDraft {
    return new NameDraft(this.#fallback, this.#validate, text);
  }
}
