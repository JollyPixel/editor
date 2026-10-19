// Import Internal Dependencies
import type {
  KindOptionField,
  KindOptions,
  KindPackageSettings
} from "./routes.ts";

type OptionRecord = Record<string, unknown>;

export class KindOptionsDraft {
  static from(
    packages: readonly KindPackageSettings[]
  ): KindOptionsDraft {
    return new KindOptionsDraft(Object.fromEntries(
      packages.map((kindPackage) => [kindPackage.name, kindPackage.options])
    ));
  }

  #kinds: KindOptions;

  constructor(
    kinds: KindOptions
  ) {
    this.#kinds = structuredClone(kinds);
  }

  value(
    packageName: string,
    field: KindOptionField
  ): number | undefined {
    let current: unknown = this.#kinds[packageName];
    for (const segment of field.path) {
      current = isRecord(current) ? current[segment] : undefined;
    }

    return typeof current === "number" ? current : undefined;
  }

  with(
    packageName: string,
    field: KindOptionField,
    value: number
  ): KindOptionsDraft {
    return new KindOptionsDraft({
      ...this.#kinds,
      [packageName]: assign(this.#kinds[packageName] ?? {}, field.path, value)
    });
  }

  toJSON(): KindOptions {
    return structuredClone(this.#kinds);
  }
}

function assign(
  record: OptionRecord,
  path: readonly string[],
  value: number
): OptionRecord {
  const [head, ...rest] = path;
  const child = record[head];

  return {
    ...record,
    [head]: rest.length === 0 ?
      value :
      assign(isRecord(child) ? child : {}, rest, value)
  };
}

function isRecord(
  value: unknown
): value is OptionRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
