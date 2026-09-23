export class QueryString {
  readonly #query: URLSearchParams;

  constructor(
    search: string = location.search
  ) {
    this.#query = new URLSearchParams(search);
  }

  flag(
    name: string
  ): boolean {
    return this.#query.has(name);
  }

  number(name: string): number | undefined;
  number(name: string, fallback: number): number;
  number(
    name: string,
    fallback?: number
  ): number | undefined {
    const value = this.#query.get(name);
    const parsed = value === null
      ? Number.NaN
      : Number(value);

    return Number.isNaN(parsed) ? fallback : parsed;
  }

  string(
    name: string
  ): string | undefined {
    return this.#query.get(name) ?? undefined;
  }
}

export class QueryParams<T> {
  readonly #parse: (query: QueryString) => T;

  constructor(
    parse: (query: QueryString) => T
  ) {
    this.#parse = parse;
  }

  read(
    search?: string
  ): T {
    return this.#parse(
      new QueryString(search)
    );
  }
}
