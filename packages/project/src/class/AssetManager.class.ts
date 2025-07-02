// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

export interface AssetManagerOptions {
  location: string;
  types: Iterable<string>;
}

export class AssetManager {
  #isInitialized = false;

  location: string;
  types = new Set<string>();

  constructor(
    options: AssetManagerOptions
  ) {
    this.location = path.join(options.location, "assets");
    this.types = new Set(options.types);
  }

  get initialized(): boolean {
    return this.#isInitialized;
  }

  async initialize(): Promise<this> {
    await fs.mkdir(this.location, { recursive: true });
    await Promise.all(
      [...this.types].map(
        (typeName) => fs.mkdir(path.join(this.location, typeName), { recursive: true })
      )
    );
    this.#isInitialized = true;

    return this;
  }

  async synchronize(): Promise<this> {
    if (!this.#isInitialized) {
      await this.initialize();
    }

    return this;
  }
}

