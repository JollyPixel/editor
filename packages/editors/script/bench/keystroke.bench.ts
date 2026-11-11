// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import { TextEdit } from "@jolly-pixel/asset.script/client";
import { marked } from "marked";

// Import Internal Dependencies
import { CodeTokens } from "#src/syntax/CodeTokens.ts";
import { highlight } from "#src/syntax/highlight.ts";
import { TextLines } from "#src/text/TextLines.ts";
import {
  fixtureText,
  type FixtureLanguage
} from "./_fixtures.ts";

// CONSTANTS
const kSizes = [12, 100];
const kLanguages: FixtureLanguage[] = ["typescript", "markdown", "json"];

const suite = defineSuite("script / keystroke", (bench) => {
  let sink = 0;
  const codeTokens: CodeTokens[] = [];

  for (const language of kLanguages) {
    for (const kilobytes of kSizes) {
      const text = fixtureText(language, kilobytes * 1024);
      const caret = text.indexOf("\n", text.length >> 1);
      const typed = `${text.slice(0, caret)}x${text.slice(caret)}`;
      const versions = [new TextLines(text), new TextLines(typed)];
      const tokens = new CodeTokens(() => undefined);
      tokens.reset(versions[0], language);
      codeTokens.push(tokens);
      let keystroke = 0;
      const label = `${language} ${kilobytes} KB`;

      bench
        .add(`highlight, ${label}`, () => {
          sink += highlight(typed, language).length;
        })
        .add(`CodeTokens.read, ${label}`, () => {
          keystroke ^= 1;
          tokens.read(versions[keystroke]);
          sink += tokens.line(0)?.tokens.length ?? 0;
        })
        .add(`TextLines, ${label}`, () => {
          sink += new TextLines(typed).count;
        })
        .add(`TextLines.widest, ${label}`, () => {
          sink += new TextLines(typed).widest;
        })
        .add(`TextEdit.between, ${label}`, () => {
          sink += TextEdit.between(text, typed, caret + 1).changes.length;
        });

      if (language === "markdown") {
        bench
          .add(`marked.lexer, ${label}`, () => {
            sink += marked.lexer(typed).length;
          })
          .add(`marked.parse, ${label}`, () => {
            sink += marked.parse(typed, { async: false }).length;
          });
      }
    }
  }

  return () => {
    for (const tokens of codeTokens) {
      tokens.dispose();
    }
    if (sink < 0) {
      throw new Error("unreachable");
    }
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
