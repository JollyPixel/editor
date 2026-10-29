export class FieldPatch<TWhole extends object> {
  readonly #fields: readonly (keyof TWhole)[];
  readonly #values: Partial<TWhole>;

  constructor(
    fields: readonly (keyof TWhole)[],
    values: Partial<TWhole>
  ) {
    this.#fields = fields.filter((field) => Object.hasOwn(values, field));
    this.#values = this.#pick(values);
  }

  fields(): (keyof TWhole)[] {
    return [...this.#fields];
  }

  applyTo(
    whole: TWhole
  ): TWhole {
    return {
      ...whole,
      ...structuredClone(this.#values)
    };
  }

  revert(
    whole: TWhole
  ): Partial<TWhole> {
    return this.#pick(whole);
  }

  #pick(
    source: Partial<TWhole>
  ): Partial<TWhole> {
    const picked: Partial<TWhole> = {};
    for (const field of this.#fields) {
      picked[field] = source[field];
    }

    return picked;
  }
}
