// Import Internal Dependencies
import {
  kindOptionVector2Schema,
  type KindOptionField,
  type KindOptions,
  type KindOptionValue,
  type KindPackageSettings
} from "../../shared/api/project.ts";

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

  value<TField extends KindOptionField>(
    packageName: string,
    field: TField
  ): KindOptionValue<TField> | undefined;
  value(
    packageName: string,
    field: KindOptionField
  ): KindOptionValue | undefined {
    let current: unknown = this.#kinds[packageName];
    for (const segment of field.path) {
      current = isRecord(current) ? current[segment] : undefined;
    }

    if (field.type === "vector2") {
      return kindOptionVector2Schema.safeParse(current).data;
    }

    return typeof current === "number" ? current : undefined;
  }

  with<TField extends KindOptionField>(
    packageName: string,
    field: TField,
    value: KindOptionValue<TField>
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
  value: KindOptionValue
): OptionRecord {
  const [head, ...rest] = path;
  const child = record[head];

  return {
    ...record,
    [head]: rest.length === 0 ?
      structuredClone(value) :
      assign(isRecord(child) ? child : {}, rest, value)
  };
}

function isRecord(
  value: unknown
): value is OptionRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
