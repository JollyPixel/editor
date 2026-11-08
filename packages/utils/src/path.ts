export function fileExtension(
  path: string
): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");

  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}
