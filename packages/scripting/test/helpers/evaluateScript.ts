// Import Internal Dependencies
import {
  importModule,
  javascriptUrl,
  linkModule,
  type ModuleExports
} from "#src/modules/linkModule.ts";

export async function evaluateScript(
  code: string
): Promise<ModuleExports> {
  const linked = await linkModule(
    code,
    (specifier) => import.meta.resolve(specifier)
  );

  return importModule(javascriptUrl(linked));
}
