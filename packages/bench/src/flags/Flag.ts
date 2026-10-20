// Import Node.js Dependencies
import type { ParseArgsOptionDescriptor } from "node:util";

// Import Internal Dependencies
import {
  parseChoice,
  parseNonNegative,
  parsePositive
} from "../utils/parse.ts";

// CONSTANTS
const kFlagColumn = 24;

export type RawFlagValue =
  | string
  | boolean
  | (string | boolean)[]
  | undefined;

export interface FlagInit<TValue> {
  option: ParseArgsOptionDescriptor;
  placeholder?: string;
  description: string;
  parse: (label: string, raw: RawFlagValue) => TValue;
}

export type FlagDefinitions<TValues> = {
  readonly [TName in keyof TValues]: Flag<TValues[TName]>;
};

export class Flag<TValue> {
  static positive(
    fallback: number,
    description: string,
    placeholder = "n"
  ): Flag<number> {
    return Flag.#valued(fallback, description, placeholder, parsePositive);
  }

  static nonNegative(
    fallback: number,
    description: string,
    placeholder = "n"
  ): Flag<number> {
    return Flag.#valued(fallback, description, placeholder, parseNonNegative);
  }

  static choice<const TChoice extends string>(
    choices: readonly TChoice[],
    fallback: NoInfer<TChoice>,
    description: string
  ): Flag<TChoice> {
    return Flag.#valued(
      fallback,
      `${description}: ${choices.join(", ")}`,
      "name",
      (label, raw) => parseChoice(label, raw, choices)
    );
  }

  static toggle(
    description: string
  ): Flag<boolean> {
    return new Flag({
      option: {
        type: "boolean",
        default: false
      },
      description,
      parse: (_label, raw) => raw === true
    });
  }

  static text(
    placeholder: string,
    description: string
  ): Flag<string | undefined> {
    return new Flag({
      option: { type: "string" },
      placeholder,
      description,
      parse: (_label, raw) => (typeof raw === "string" ? raw : undefined)
    });
  }

  static list(
    placeholder: string,
    description: string
  ): Flag<string[]> {
    return new Flag({
      option: {
        type: "string",
        multiple: true,
        default: []
      },
      placeholder,
      description,
      parse: (_label, raw) => (Array.isArray(raw) ?
        raw.filter((value) => typeof value === "string") :
        [])
    });
  }

  static #valued<TValue>(
    fallback: number | string,
    description: string,
    placeholder: string,
    parse: (label: string, raw: string) => TValue
  ): Flag<TValue> {
    return new Flag({
      option: {
        type: "string",
        default: String(fallback)
      },
      placeholder,
      description: `${description} (default ${fallback})`,
      parse: (label, raw) => parse(label, String(raw))
    });
  }

  readonly option: ParseArgsOptionDescriptor;

  #placeholder: string | undefined;
  #description: string;
  #parse: (label: string, raw: RawFlagValue) => TValue;

  constructor(
    init: FlagInit<TValue>
  ) {
    this.option = init.option;
    this.#placeholder = init.placeholder;
    this.#description = init.description;
    this.#parse = init.parse;
  }

  parse(
    name: string,
    raw: RawFlagValue
  ): TValue {
    return this.#parse(`--${name}`, raw);
  }

  usage(
    name: string
  ): string {
    const flag = this.#placeholder === undefined ?
      `--${name}` :
      `--${name} <${this.#placeholder}>`;

    return `  ${flag.padEnd(kFlagColumn)} ${this.#description}`;
  }
}
