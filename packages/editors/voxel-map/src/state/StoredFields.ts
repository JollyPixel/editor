export class StoredFields {
  static parse(
    raw: string | null
  ): StoredFields {
    try {
      return new StoredFields(raw === null ? null : JSON.parse(raw));
    }
    catch {
      return new StoredFields(null);
    }
  }

  #fields: Map<string, unknown>;

  constructor(
    value: unknown
  ) {
    this.#fields = typeof value === "object" && value !== null ?
      new Map(Object.entries(value)) :
      new Map();
  }

  boolean(
    key: string,
    fallback: boolean
  ): boolean {
    const value = this.#fields.get(key);

    return typeof value === "boolean" ? value : fallback;
  }

  number(
    key: string,
    fallback: number
  ): number {
    const value = this.#fields.get(key);

    return typeof value === "number" && Number.isFinite(value) ?
      value :
      fallback;
  }

  oneOf<T>(
    key: string,
    values: readonly T[],
    fallback: T
  ): T {
    const value = this.#fields.get(key);

    return values.find((known) => known === value) ?? fallback;
  }
}
