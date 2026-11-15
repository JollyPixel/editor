// Import Internal Dependencies
import { GAME_MODULES_DIR } from "./api.ts";

// CONSTANTS
const kModuleExtension = ".js";
const kUrlDelimiters = /[%?#]/g;
const kSpecifierAliases = [
  {
    specifier: "",
    script: ".ts"
  },
  {
    specifier: ".js",
    script: ".ts"
  }
] as const;

export class GameModule {
  static parse(
    path: string
  ): GameModule | null {
    return path.endsWith(kModuleExtension) ?
      new GameModule(path.slice(0, -kModuleExtension.length)) :
      null;
  }

  static resolve(
    specifier: string,
    scripts: Pick<ReadonlySet<string>, "has">
  ): string | undefined {
    const candidates = [
      specifier,
      ...kSpecifierAliases
        .filter((alias) => specifier.endsWith(alias.specifier))
        .map((alias) => swapSuffix(specifier, alias.specifier, alias.script))
    ];

    return candidates.find((candidate) => scripts.has(candidate));
  }

  readonly script: string;

  #file: string;

  constructor(
    script: string
  ) {
    this.script = script;
    this.#file = `${script}${kModuleExtension}`;
  }

  get segments(): string[] {
    return [GAME_MODULES_DIR, ...this.#file.split("/")];
  }

  url(
    revision: string
  ): string {
    return `${moduleUrl(this.#file)}?revision=${encodeURIComponent(revision)}`;
  }

  specifiers(): string[] {
    return [
      this.script,
      ...kSpecifierAliases
        .filter((alias) => this.script.endsWith(alias.script))
        .map((alias) => swapSuffix(this.script, alias.script, alias.specifier))
    ];
  }
}

export function moduleUrl(
  path: string
): string {
  const escaped = path.replaceAll(
    kUrlDelimiters,
    (delimiter) => encodeURIComponent(delimiter)
  );

  return `${GAME_MODULES_DIR}/${escaped}`;
}

function swapSuffix(
  text: string,
  from: string,
  to: string
): string {
  return `${text.slice(0, text.length - from.length)}${to}`;
}
