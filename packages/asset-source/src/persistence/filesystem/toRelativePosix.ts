// Import Node.js Dependencies
import path from "node:path";

export function toRelativePosix(
  root: string,
  absolute: string
): string | null {
  const relative = path.relative(root, absolute);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }

  return relative.replaceAll("\\", "/");
}
