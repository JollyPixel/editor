/**
 * Why a name is refused, or `null` to accept it.
 */
export type NameValidator = (name: string) => string | null;

export interface NameFieldOptions {
  /**
   * Prefilled, and used when the field is left blank.
   */
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
  readonly name: string;
  readonly error: string | null;
  readonly #fallback: string;
  readonly #validate: NameValidator;

  constructor(
    fallback: string,
    validate: NameValidator = () => null,
    text = fallback
  ) {
    this.text = text;
    this.name = text.trim() || fallback;
    this.error = validate(this.name);
    this.#fallback = fallback;
    this.#validate = validate;
  }

  edit(
    text: string
  ): NameDraft {
    return new NameDraft(this.#fallback, this.#validate, text);
  }

  revalidate(): NameDraft {
    return this.edit(this.text);
  }
}
