export class NameAllowList {
  static readonly schema = [
    {
      type: "object",
      properties: {
        allow: {
          type: "array",
          items: {
            type: "string"
          }
        }
      },
      additionalProperties: false
    }
  ];

  static parse(
    options: readonly unknown[],
    defaults: readonly string[] = []
  ): NameAllowList {
    const [first] = options;
    const names = new Set(defaults);
    if (typeof first === "object" && first !== null && "allow" in first && Array.isArray(first.allow)) {
      for (const name of first.allow) {
        names.add(String(name));
      }
    }

    return new NameAllowList(names);
  }

  readonly #names: ReadonlySet<string>;

  constructor(
    names: ReadonlySet<string>
  ) {
    this.#names = names;
  }

  has(name: string): boolean {
    return this.#names.has(name);
  }
}
