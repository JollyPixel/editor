// Import Internal Dependencies
import { GAME_MODULES_DIR } from "./api.ts";

// CONSTANTS
const kModuleExtension = ".js";
const kUrlDelimiters = /[%?#]/g;

export class GameModule {
  static parse(
    path: string
  ): GameModule | null {
    return path.endsWith(kModuleExtension) ?
      new GameModule(path.slice(0, -kModuleExtension.length)) :
      null;
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
