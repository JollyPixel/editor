// Import Internal Dependencies
import { ScriptImportError } from "./errors/ScriptImportError.ts";
import { staticImports } from "./staticImports.ts";

export interface ScriptImportPolicyOptions {
  /**
   * Bare specifiers the game resolves to its own modules.
   */
  modules: Iterable<string>;
  /**
   * Whether `./` and `../` specifiers, which name another script, are allowed.
   */
  relative: boolean;
}

export class ScriptImportPolicy {
  readonly modules: ReadonlySet<string>;
  readonly relative: boolean;

  constructor(
    options: ScriptImportPolicyOptions
  ) {
    this.modules = new Set(options.modules);
    this.relative = options.relative;
  }

  allows(
    specifier: string
  ): boolean {
    return this.modules.has(specifier) ||
      (this.relative && isRelativeSpecifier(specifier));
  }

  async check(
    code: string
  ): Promise<void> {
    for (const { specifier } of await staticImports(code)) {
      if (!this.allows(specifier)) {
        throw this.refusal(specifier);
      }
    }
  }

  refusal(
    specifier: string
  ): ScriptImportError {
    const modules = Array.from(this.modules, (name) => `"${name}"`).join(", ");
    const allowed = this.relative ?
      `${modules} and other scripts by relative path` :
      modules;

    return new ScriptImportError(
      `"${specifier}" cannot be imported: allowed imports are ${allowed}.`
    );
  }
}

export function isRelativeSpecifier(
  specifier: string
): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}
