// Import Third-party Dependencies
import {
  describeErrors,
  SchemaParser,
  type Infer,
  type Schema
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { InvalidAssetFileError } from "./errors/InvalidAssetFileError.ts";

// CONSTANTS
export const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export interface JsonAssetFileCodec<
  TSchema extends Schema,
  TFile
> {
  expand: (stored: Infer<TSchema>) => TFile;
  compact: (file: TFile) => Infer<TSchema>;
}

export type JsonAssetFileOptions<
  TSchema extends Schema,
  TFile
> = {
  kind: string;
  schema: TSchema;
  isInvalid?: (error: unknown) => error is Error;
} & (
  [TFile] extends [Infer<TSchema>] ?
    [Infer<TSchema>] extends [TFile] ?
      Partial<JsonAssetFileCodec<TSchema, TFile>> :
      JsonAssetFileCodec<TSchema, TFile> :
    JsonAssetFileCodec<TSchema, TFile>
);

export class JsonAssetFile<
  TSchema extends Schema,
  TFile = Infer<TSchema>
> {
  readonly kind: string;

  #parser: SchemaParser<TSchema>;
  #expand: (stored: Infer<TSchema>) => TFile;
  #compact: (file: TFile) => Infer<TSchema>;
  #isInvalid: (error: unknown) => error is Error;

  constructor(
    options: JsonAssetFileOptions<TSchema, TFile>
  ) {
    this.kind = options.kind;
    this.#parser = new SchemaParser(options.schema);
    this.#expand = options.expand ?? ((stored) => stored as TFile);
    this.#compact = options.compact ?? ((file) => file as Infer<TSchema>);
    this.#isInvalid = options.isInvalid ?? ((_error): _error is Error => false);
  }

  encode(
    file: TFile
  ): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(this.#compact(file)));
  }

  decode(
    content: Uint8Array
  ): TFile {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(content));
    }
    catch (error) {
      throw new InvalidAssetFileError(
        this.kind,
        "content is not JSON",
        { cause: error }
      );
    }

    const result = this.#parser.parse(parsed);
    if (result.err) {
      throw new InvalidAssetFileError(
        this.kind,
        describeErrors(result.val)
      );
    }

    return this.#expand(result.val);
  }

  load(
    content: Uint8Array,
    into: (file: TFile) => void
  ): void {
    const file = this.decode(content);
    try {
      into(file);
    }
    catch (error) {
      if (this.#isInvalid(error)) {
        throw new InvalidAssetFileError(this.kind, error.message, { cause: error });
      }

      throw error;
    }
  }
}
