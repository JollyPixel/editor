// Import Node.js Dependencies
import {
  parseArgs,
  type ParseArgsOptionsConfig
} from "node:util";

// Import Internal Dependencies
import { BenchmarkError } from "../errors/index.ts";
import {
  Flag,
  type FlagDefinitions,
  type RawFlagValue
} from "./Flag.ts";

// CONSTANTS
const kHelp = Flag.toggle("print this message");

export type ParsedFlags<TValues> =
  | {
    help: true;
  }
  | {
    help: false;
    values: TValues;
    positionals: string[];
  };

interface TokenizedArgs {
  values: Record<string, RawFlagValue>;
  positionals: string[];
}

export interface FlagSetParseOptions {
  allowPositionals?: boolean;
}

export class FlagSet<TValues extends object> {
  #flags: Readonly<Record<string, Flag<unknown>>>;

  constructor(
    flags: FlagDefinitions<TValues>
  ) {
    this.#flags = flags;
  }

  extend<TMore extends object>(
    flags: FlagDefinitions<TMore>
  ): FlagSet<TValues & TMore> {
    return new FlagSet<TValues & TMore>({
      ...this.#flags,
      ...flags
    } as FlagDefinitions<TValues & TMore>);
  }

  usage(): string {
    return Object.entries({
      ...this.#flags,
      help: kHelp
    })
      .map(([name, flag]) => flag.usage(name))
      .join("\n");
  }

  parse(
    args: string[],
    options: FlagSetParseOptions = {}
  ): ParsedFlags<TValues> {
    const { values: raw, positionals } = this.#tokenize(args, options);
    if (raw.help === true) {
      return { help: true };
    }

    const values: Record<string, unknown> = {};
    for (const [name, flag] of Object.entries(this.#flags)) {
      values[name] = flag.parse(name, raw[name]);
    }

    return {
      help: false,
      values: values as TValues,
      positionals
    };
  }

  #tokenize(
    args: string[],
    options: FlagSetParseOptions
  ): TokenizedArgs {
    const config: ParseArgsOptionsConfig = {
      help: kHelp.option
    };
    for (const [name, flag] of Object.entries(this.#flags)) {
      config[name] = flag.option;
    }

    try {
      return parseArgs({
        args,
        options: config,
        allowPositionals: options.allowPositionals ?? false
      });
    }
    catch (error) {
      if (error instanceof TypeError) {
        throw new BenchmarkError(error.message, { cause: error });
      }
      throw error;
    }
  }
}
