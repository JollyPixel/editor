export function normalizePosix(
  relative: string
): string {
  const segments: string[] = [];
  for (const segment of relative.split("/")) {
    if (
      segment === "" ||
      segment === "."
    ) {
      continue;
    }

    if (
      segment === ".." &&
      segments.length > 0 &&
      segments.at(-1) !== ".."
    ) {
      segments.pop();

      continue;
    }

    segments.push(segment);
  }

  const joined = segments.join("/");
  if (joined === "") {
    return relative.endsWith("/") ? "./" : ".";
  }

  return relative.endsWith("/") ? `${joined}/` : joined;
}
