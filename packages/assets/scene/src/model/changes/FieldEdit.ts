export type FieldKey<TFields> = Extract<keyof TFields, string>;

export class FieldEdit<TFields extends object> {
  readonly set: Partial<TFields>;
  readonly unset: readonly FieldKey<TFields>[];

  constructor(
    set: Partial<TFields> = {},
    unset: Iterable<FieldKey<TFields>> = []
  ) {
    this.set = set;
    this.unset = [...unset];
  }

  get contradicts(): boolean {
    return this.unset.some((key) => Object.hasOwn(this.set, key));
  }

  fields(): FieldKey<TFields>[] {
    return [...keysIn(this.set), ...this.unset];
  }

  applyTo(
    current: Partial<TFields>
  ): Partial<TFields> {
    const next: Partial<TFields> = {
      ...current,
      ...structuredClone(this.set)
    };
    for (const key of this.unset) {
      delete next[key];
    }

    return next;
  }

  revert(
    current: Partial<TFields>
  ): FieldEdit<TFields> {
    const set: Partial<TFields> = {};
    const unset: FieldKey<TFields>[] = [];
    for (const key of this.fields()) {
      if (Object.hasOwn(current, key)) {
        set[key] = current[key];
      }
      else {
        unset.push(key);
      }
    }

    return new FieldEdit(set, unset);
  }
}

export function keysIn<TFields extends object>(
  fields: TFields
): FieldKey<TFields>[] {
  const keys: FieldKey<TFields>[] = [];
  for (const key in fields) {
    if (Object.hasOwn(fields, key)) {
      keys.push(key);
    }
  }

  return keys;
}
