export function axisValues(
  value: Readonly<Record<string, unknown>>,
  axes: readonly string[],
  current: readonly number[]
): number[] {
  return axes.map((axis, index) => {
    const next = value[axis];

    return typeof next === "number" ? next : current[index] ?? 0;
  });
}
