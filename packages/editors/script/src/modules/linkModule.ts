// Import Third-party Dependencies
import { staticImports } from "@jolly-pixel/asset.script/client";

export type ModuleExports = Record<string, unknown>;

export type ModuleResolver = (
  specifier: string
) => string | Promise<string>;

export async function linkModule(
  code: string,
  resolve: ModuleResolver
): Promise<string> {
  let linked = code;
  for (const entry of (await staticImports(code)).reverse()) {
    linked = linked.slice(0, entry.start) +
      await resolve(entry.specifier) +
      linked.slice(entry.end);
  }

  return linked;
}

export function moduleUrl(
  code: string,
  sourceUrl: string
): string {
  return javascriptUrl(`${code}\n//# sourceURL=${sourceUrl}`);
}

export function importModule(
  url: string
): Promise<ModuleExports> {
  return import(
    /* @vite-ignore */
    url
  );
}

export function javascriptUrl(
  source: string
): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
}
