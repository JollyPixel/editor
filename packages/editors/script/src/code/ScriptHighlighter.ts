// Import Third-party Dependencies
import {
  createCssVariablesTheme,
  createHighlighterCore,
  type GrammarState,
  type HighlighterCore,
  type ThemedToken
} from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";

// Import Internal Dependencies
import {
  LineTokenCache,
  type LineTokenizer,
  type TokenizedLine
} from "./LineTokenCache.ts";

export type ScriptLanguage = "typescript" | "javascript";

// CONSTANTS
const kTheme = createCssVariablesTheme({
  name: "jolly-script",
  variablePrefix: "--shiki-"
});

const kGrammars = {
  typescript: () => import("@shikijs/langs/typescript"),
  javascript: () => import("@shikijs/langs/javascript")
} satisfies Record<ScriptLanguage, unknown>;

let highlighter: Promise<HighlighterCore> | null = null;

export class ScriptHighlighter {
  static async create(
    language: ScriptLanguage
  ): Promise<ScriptHighlighter> {
    highlighter ??= createHighlighterCore({
      themes: [kTheme],
      langs: [],
      engine: createJavaScriptRegexEngine()
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
