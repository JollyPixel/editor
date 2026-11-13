export function unusedName(
  base: string,
  taken: (name: string) => boolean,
  separator = " "
): string {
  for (let suffix = 1; ; suffix++) {
    const name = suffix === 1 ? base : `${base}${separator}${suffix}`;
    if (!taken(name)) {
      return name;
    }
  }
}
