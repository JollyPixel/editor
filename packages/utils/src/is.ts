export function object(
  value: unknown
): value is object {
  return typeof value === "object" && value !== null;
}

export function plainObject(
  value: unknown
): value is Record<string, unknown> {
  if (!object(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

export function member<const T>(
  value: unknown,
  choices: readonly T[]
): value is T {
  return choices.some((choice) => choice === value);
}
