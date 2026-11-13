// Import Third-party Dependencies
import { parseJsonObject } from "@jolly-pixel/utils";

export class StoredFields {
  static parse(
    raw: string | null
  ): StoredFields {
    return new StoredFields(parseJsonObject(raw));
  }

  #fields: Map<string, unknown>;

  constructor(
    fields: Record<string, unknown>
  ) {
    this.#fields = new Map(Object.entries(fields));
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

  choice<T>(
    key: string,
    values: readonly T[],
    fallback: T
  ): T {
    const value = this.#fields.get(key);

    return values.find((known) => known === value) ?? fallback;
  }
}
