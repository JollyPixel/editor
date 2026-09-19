export type DevOptionParser<T> = (value: string | null) => T;

export type DevOptionSchema<T> = {
  [K in keyof T]: DevOptionParser<T[K]>;
};

export class DevOptions<T> {
  static flag(): DevOptionParser<boolean> {
    return (value) => value !== null;
  }

  static number(): DevOptionParser<number | undefined>;
  static number(fallback: number): DevOptionParser<number>;
  static number(
    fallback?: number
  ): DevOptionParser<number | undefined> {
    return (value) => {
      const parsed = value === null ? Number.NaN : Number(value);

      return Number.isNaN(parsed) ? fallback : parsed;
    };
  }

  static string(): DevOptionParser<string | undefined> {
    return (value) => value ?? undefined;
  }

  readonly schema: DevOptionSchema<T>;

  constructor(
    schema: DevOptionSchema<T>
  ) {
    this.schema = schema;
  }

  read(
    search: string = location.search
  ): T {
    const query = new URLSearchParams(search);
    const options = {} as T;
    for (const key of Object.keys(this.schema) as (keyof T & string)[]) {
      options[key] = this.schema[key](query.get(toParamName(key)));
    }

    return options;
  }
}

function toParamName(
  key: string
): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
