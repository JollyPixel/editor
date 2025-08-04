export interface ParsedPath {
  dir: string;
  base: string;
  name: string;
  ext: string;
}

export function parse(
  nonNormalizedPath: string
): ParsedPath {
  const normalized = nonNormalizedPath.replace(/\\/g, "/");

  const lastSlash = normalized.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : normalized.slice(0, lastSlash + 1);
  const base = lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);

  const parsedExt = extname(base);
  const name = parsedExt ?
    base.slice(0, base.length - parsedExt.length) :
    base;

  return { dir, base, name, ext: parsedExt };
}

export function extname(
  filename: string
): string {
  const lastDot = filename.lastIndexOf(".");
  // Ignore les fichiers cachés comme « .gitignore »
  const hasDot = lastDot > 0;

  return hasDot ? filename.slice(lastDot) : "";
}
