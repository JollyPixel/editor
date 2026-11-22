export function mergeDefined<T extends object>(
  base: T,
  patch: Readonly<Partial<T>>
): T {
  const merged = { ...base };
  for (const key of Object.keys(base) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

export function sameFields<T extends object>(
  left: T,
  right: T,
  keys: Iterable<keyof T> = Object.keys(left) as (keyof T)[]
): boolean {
  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
}
