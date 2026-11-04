export function fileExtension(
  name: string
): string {
  const dot = name.lastIndexOf(".");

  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}
