// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

// Import Third-party Dependencies
import {
  describeErrors,
  SchemaParser,
  type Infer
} from "@jolly-pixel/network";
import { is } from "@jolly-pixel/utils";
import * as z from "zod/mini";

// Import Internal Dependencies
import { PROJECT_FILE_PATH } from "../../storage/stateDirectory.ts";

// CONSTANTS
const kRetiredOption = "snapshot";
const kProjectFileSchema = z.object({
  version: z.literal(1),
  kinds: z.optional(z.record(
    z.string(),
    z.record(z.string(), z.unknown())
  ))
});
const kProjectFileParser = new SchemaParser(kProjectFileSchema);

export type ProjectFileData = Infer<typeof kProjectFileSchema> &
  Readonly<Record<string, unknown>>;

export interface ProjectFileOpenOptions {
  /**
   * Keeps `data` in memory without reading or writing the project file.
   * @default false
   */
  inMemory?: boolean;
}

export class ProjectFile {
  readonly root: string;
  readonly path: string;
  readonly inMemory: boolean;

  #data: ProjectFileData;

  static async read(
    root: string
  ): Promise<ProjectFile> {
    try {
      return ProjectFile.parse(
        root,
        await fs.readFile(path.join(root, PROJECT_FILE_PATH), "utf8")
      );
    }
    catch (error) {
      if (hasErrorCode(error, "ENOENT")) {
        return new ProjectFile(root, {
          version: 1
        });
      }

      throw error;
    }
  }

  static async readOrCreate(
    root: string,
    data: ProjectFileData
  ): Promise<ProjectFile> {
    const file = path.join(root, PROJECT_FILE_PATH);
    await fs.mkdir(
      path.dirname(file),
      { recursive: true }
    );

    try {
      await fs.writeFile(
        file,
        serialize(data),
        { flag: "wx" }
      );
    }
    catch (error) {
      if (!hasErrorCode(error, "EEXIST")) {
        throw error;
      }
    }

    return ProjectFile.read(root);
  }

  static async open(
    root: string,
    data: ProjectFileData,
    options: ProjectFileOpenOptions = {}
  ): Promise<ProjectFile> {
    const { inMemory = false } = options;

    return inMemory ?
      new ProjectFile(root, data, { inMemory }) :
      ProjectFile.readOrCreate(root, data);
  }

  static parse(
    root: string,
    rawData: string
  ): ProjectFile {
    const file = path.join(root, PROJECT_FILE_PATH);
    let json: unknown;
    try {
      json = JSON.parse(rawData);
    }
    catch (error) {
      throw new TypeError(
        `"${file}" is not valid JSON.`,
        { cause: error }
      );
    }

    const result = kProjectFileParser.parse(json);
    if (result.err) {
      throw new TypeError(
        `"${file}" is invalid: ${describeErrors(result.val)}`
      );
    }

    return new ProjectFile(root, withoutRetiredOptions(result.val));
  }

  constructor(
    root: string,
    data: ProjectFileData,
    options: ProjectFileOpenOptions = {}
  ) {
    this.root = root;
    this.path = path.join(root, PROJECT_FILE_PATH);
    this.inMemory = options.inMemory ?? false;
    this.#data = structuredClone(data);
  }

  get data(): Readonly<Record<string, unknown>> {
    return this.#data;
  }

  get kinds(): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
    return new Map(
      Object.entries(this.#data.kinds ?? {})
    );
  }

  async replace(
    sections: Readonly<Record<string, unknown>>
  ): Promise<void> {
    const result = kProjectFileParser.parse({
      ...this.#data,
      ...sections
    });
    if (result.err) {
      const names = Object.keys(sections).join(", ");

      throw new TypeError(
        `"${names}" is invalid: ${describeErrors(result.val)}`
      );
    }

    const previous = this.#data;
    this.#data = structuredClone(result.val);
    if (this.inMemory) {
      return;
    }

    try {
      const temporary = `${this.path}.tmp`;
      await fs.writeFile(temporary, serialize(this.#data));
      await fs.rename(temporary, this.path);
    }
    catch (error) {
      this.#data = previous;

      throw error;
    }
  }

  async isStale(): Promise<boolean> {
    try {
      const current = ProjectFile.parse(
        this.root,
        await fs.readFile(this.path, "utf8")
      );

      return !isDeepStrictEqual(current.data, this.#data);
    }
    catch {
      return true;
    }
  }
}

function withoutRetiredOptions(
  data: ProjectFileData
): ProjectFileData {
  if (data.kinds === undefined) {
    return data;
  }

  return {
    ...data,
    kinds: Object.fromEntries(
      Object.entries(data.kinds).map(
        ([name, options]) => [name, kindOptionsWithoutRetired(options)]
      )
    )
  };
}

function kindOptionsWithoutRetired(
  options: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const kept = withoutRetired(options);
  for (const [key, value] of Object.entries(kept)) {
    if (is.plainObject(value)) {
      kept[key] = withoutRetired(value);
    }
  }

  return kept;
}

function withoutRetired(
  record: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== kRetiredOption)
  );
}

function serialize(
  data: ProjectFileData
): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function hasErrorCode(
  error: unknown,
  code: string
): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
