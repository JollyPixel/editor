export function sourcePackage(
  source: string
): string {
  const normalized = source.replaceAll("\\", "/");
  const nodeModules = normalized.lastIndexOf("node_modules/");
  if (nodeModules !== -1) {
    const [scope, name] = normalized.slice(nodeModules + 13).split("/");

    return scope.startsWith("@") ? `${scope}/${name}` : scope;
  }

  const workspace = /packages\/(?:(editors|assets)\/)?([\w.-]+)\//.exec(normalized);
  if (workspace === null) {
    return "(this package)";
  }
  const [, group, name] = workspace;
  if (group === "editors") {
    return `@jolly-pixel/editor.${name}`;
  }
  if (group === "assets") {
    return `@jolly-pixel/asset.${name}`;
  }

  return `@jolly-pixel/${name}`;
}
