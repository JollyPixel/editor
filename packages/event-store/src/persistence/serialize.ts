export function toJson(
  value: unknown,
  field: string
): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError(`${field} must be JSON-serializable`);
  }

  return json;
}

export function toStoredValue<T>(
  value: T,
  field: string
): T {
  return JSON.parse(toJson(value, field)) as T;
}
