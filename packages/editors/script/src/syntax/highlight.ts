// Import Third-party Dependencies
import type { LanguageName } from "sugar-high";
import {
  parse,
  type ParsedLine,
  type ParseOptions
} from "sugar-high/core";
import {
  lang,
  languages
} from "sugar-high/lang";
import { fileExtension } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { WGSL_SYNTAX } from "./wgsl.ts";

// CONSTANTS
const kSyntaxes = new Map<ScriptLanguage, ParseOptions | undefined>([
  ...languages.map((language) => [language.id, language.config] as const),
  ["wgsl", WGSL_SYNTAX]
]);

export type ScriptLanguage = LanguageName | "wgsl";

export function fileLanguage(
  path: string
): ScriptLanguage {
  return lang(fileExtension(path)) ?? "plaintext";
}

export function highlight(
  text: string,
  language: ScriptLanguage
): readonly ParsedLine[] {
  return parse(text, kSyntaxes.get(language)).lines;
}
