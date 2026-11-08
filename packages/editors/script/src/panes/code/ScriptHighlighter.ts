// Import Third-party Dependencies
import {
  createCssVariablesTheme,
  createHighlighterCore,
  type GrammarState,
  type HighlighterCore,
  type ThemedToken
} from "@shikijs/core";
import { createJavaScriptRawEngine } from "@shikijs/engine-javascript/raw";
import { fileExtension } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  LineTokenCache,
  type LineTokenizer,
  type TokenizedLine
} from "./LineTokenCache.ts";

// CONSTANTS
const kTheme = createCssVariablesTheme({
  name: "jolly-script",
  variablePrefix: "--shiki-"
});

const kGrammars = {
  typescript: () => import("@shikijs/langs-precompiled/typescript"),
  javascript: () => import("@shikijs/langs-precompiled/javascript"),
  json: () => import("@shikijs/langs-precompiled/json"),
  jsonc: () => import("@shikijs/langs-precompiled/jsonc"),
  yaml: () => import("@shikijs/langs-precompiled/yaml"),
  toml: () => import("@shikijs/langs-precompiled/toml"),
  xml: () => import("@shikijs/langs-precompiled/xml"),
  html: () => import("@shikijs/langs-precompiled/html"),
  css: () => import("@shikijs/langs-precompiled/css"),
  markdown: () => import("@shikijs/langs-precompiled/markdown"),
  wgsl: () => import("@shikijs/langs-precompiled/wgsl")
};

const kLanguages = new Map<string, ScriptLanguage>([
  [".ts", "typescript"],
  [".js", "javascript"],
  [".json", "json"],
  [".jsonc", "jsonc"],
  [".yml", "yaml"],
  [".yaml", "yaml"],
  [".toml", "toml"],
  [".xml", "xml"],
  [".html", "html"],
  [".css", "css"],
  [".md", "markdown"]
]);

export type ScriptLanguage = keyof typeof kGrammars;

export function fileLanguage(
  path: string
): ScriptLanguage | null {
  return kLanguages.get(fileExtension(path)) ?? null;
}

let highlighter: Promise<HighlighterCore> | null = null;

export class ScriptHighlighter {
  static async create(
    language: ScriptLanguage
  ): Promise<ScriptHighlighter> {
    highlighter ??= createHighlighterCore({
      themes: [kTheme],
      langs: [],
      engine: createJavaScriptRawEngine()
    });
    const core = await highlighter;
    if (!core.getLoadedLanguages().includes(language)) {
      await core.loadLanguage(kGrammars[language]());
    }

    return new ScriptHighlighter(core, language);
  }

  #cache: LineTokenCache<ThemedToken, GrammarState | undefined>;

  constructor(
    core: HighlighterCore,
    language: ScriptLanguage
  ) {
    const tokenizer: LineTokenizer<ThemedToken, GrammarState | undefined> = {
      tokenize: (line, state): TokenizedLine<ThemedToken, GrammarState | undefined> => {
        const lines = core.codeToTokensBase(line, {
          lang: language,
          theme: kTheme.name,
          grammarState: state ?? undefined
        });

        return {
          tokens: lines[0] ?? [],
          state: core.getLastGrammarState(lines)
        };
      },
      sameState: (left, right) => sameScopes(left, right)
    };
    this.#cache = new LineTokenCache(tokenizer);
  }

  update(
    lines: readonly string[]
  ): void {
    this.#cache.update(lines);
  }

  tokens(
    line: number
  ): readonly ThemedToken[] | null {
    return this.#cache.tokens(line);
  }
}

function sameScopes(
  left: GrammarState | undefined,
  right: GrammarState | undefined
): boolean {
  const leftScopes = left?.getScopes() ?? [];
  const rightScopes = right?.getScopes() ?? [];

  return leftScopes.length === rightScopes.length &&
    leftScopes.every((scope, index) => scope === rightScopes[index]);
}
